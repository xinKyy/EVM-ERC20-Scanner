# 提现回调重试机制实现总结

## 🎯 功能概述

实现了完整的提现回调通知重试机制，当提现回调发送失败时，系统会自动每30秒重试一次，直到成功或达到最大重试次数。

## 🏗️ 架构设计

### 1. 数据模型 (`PendingCallback`)
- **类型**: `withdrawal` | `deposit`
- **关联ID**: 提现记录或转账记录的ID
- **重试配置**: 最多重试20次，每次间隔30秒
- **状态管理**: `pending` | `completed` | `failed`
- **去重索引**: 基于 `type + relatedId + transferStatus` 组合

### 2. 核心服务扩展 (`WebhookService`)

#### 新增方法：
- `addPendingCallback()` - 添加待重试回调
- `processPendingCallbacks()` - 处理待重试回调（去重查询）
- `retryCallback()` - 重试单个回调
- `startCallbackRetryProcessor()` - 启动重试处理器
- `cleanupOldCallbacks()` - 清理旧记录

#### 重试逻辑：
1. **立即重试**: 3次快速重试（指数退避）
2. **持久重试**: 失败后加入重试队列，每30秒重试
3. **去重处理**: 聚合查询避免重复处理
4. **成功清理**: 成功后自动清理其他重复任务

### 3. 集成点

#### WithdrawalService 集成：
- 提现申请成功时发送状态 `0` 回调
- 提现处理成功时发送状态 `1` 回调  
- 提现处理失败时发送状态 `2` 回调

#### ScannerService 集成：
- 服务启动时自动启动回调重试处理器
- 每30秒检查并处理待重试回调

## 📊 重试状态说明

### transferStatus 含义：
- `0`: 提现申请成功
- `1`: 提现成功
- `2`: 转账失败

### 重试策略：
- **最大重试次数**: 20次
- **重试间隔**: 30秒
- **去重机制**: 基于 `type + relatedId + transferStatus` 组合
- **自动清理**: 成功后清理重复任务，7天后清理历史记录

## 🔍 监控和调试

### 日志关键词：
```bash
# 查看重试相关日志
pm2 logs bsc-scanner | grep "回调重试"

# 查看添加到队列的回调
pm2 logs bsc-scanner | grep "添加回调到重试队列"

# 查看重试成功的回调
pm2 logs bsc-scanner | grep "回调重试成功"
```

### MongoDB 查询：
```javascript
// 查看待重试的回调
db.pendingcallbacks.find({status: "pending"}).pretty()

// 查看特定提现的回调
db.pendingcallbacks.find({relatedId: "WITHDRAWAL_ID"}).pretty()

// 统计重试状态
db.pendingcallbacks.aggregate([
  {$group: {_id: "$status", count: {$sum: 1}}}
])
```

## ✅ 测试验证

### 测试脚本：
- `test-callback-retry.js` - 完整的回调重试测试
- `test-withdrawal.js` - 提现功能综合测试

### 验证要点：
1. ✅ 提现申请成功回调重试
2. ✅ 提现成功回调重试  
3. ✅ 提现失败回调重试
4. ✅ 去重机制防止重复处理
5. ✅ 重试次数正确递增
6. ✅ 30秒间隔重试
7. ✅ 成功后自动清理重复任务

## 🚀 部署状态

- ✅ 代码已编译并部署
- ✅ PM2 服务正常运行
- ✅ 回调重试处理器已启动
- ✅ 测试验证通过

## 📈 性能优化

### 已实现优化：
1. **聚合查询去重** - 避免处理重复回调
2. **批量更新清理** - 成功后批量清理重复任务
3. **索引优化** - 复合索引提升查询性能
4. **限制并发** - 每次最多处理50个回调，避免系统过载

### 监控建议：
- 定期检查 `PendingCallback` 集合大小
- 监控重试成功率
- 关注长期失败的回调记录

---

**总结**: 提现回调重试机制已完全实现并正常运行，能够确保重要的业务通知最终送达，大大提升了系统的可靠性。
