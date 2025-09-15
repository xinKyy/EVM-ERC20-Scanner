# BSC Scanner API 使用示例

## 提现接口 (Withdrawal API)

### 创建提现请求

**接口**: `POST /api/withdrawal/create`

#### 请求参数

| 参数名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| `toAddress` | string | 是 | 提现目标地址（BSC地址格式） |
| `amount` | string | 是 | 提现金额（wei单位或小数格式） |
| `userId` | string | 否 | 用户ID |
| `transId` | string | 否 | **外部交易ID**，由请求方提供用于标识这笔提现 |

#### 请求示例

```javascript
// 带外部交易ID的提现请求
const response = await axios.post('/api/withdrawal/create', {
  toAddress: '0xe962856664ed05cc0aace18ae83c444d75bfc9c6',
  amount: '1000000000000000000', // 1 USDT (wei格式)
  // 或者使用小数格式: amount: '1.0'
  userId: 'user_12345',
  transId: 'EXT_TXN_20250915_001' // 外部交易ID
});

// 不带外部交易ID的提现请求
const response2 = await axios.post('/api/withdrawal/create', {
  toAddress: '0xe962856664ed05cc0aace18ae83c444d75bfc9c6',
  amount: '0.5', // 0.5 USDT (小数格式)
  userId: 'user_12345'
  // transId 可选
});
```

#### 响应示例

```json
{
  "success": true,
  "message": "提现请求创建成功",
  "data": {
    "withdrawalId": "68c7b4e16a41f24af993b7a7",
    "transId": "EXT_TXN_20250915_001",
    "toAddress": "0xe962856664ed05cc0aace18ae83c444d75bfc9c6",
    "amount": "1.000000",
    "status": "pending",
    "transactionHash": null
  }
}
```

## Webhook 回调通知

### 提现回调 (Withdrawal Callback)

**URL**: 配置的 `WITHDRAWAL_CALLBACK_URL`

#### 回调参数

| 参数名 | 类型 | 描述 |
|--------|------|------|
| `address` | string | 提现目标地址 |
| `amount` | string | 提现金额（USDT格式） |
| `hash` | string | 交易哈希（完成时才有） |
| `timestamp` | string | 时间戳 |
| `transId` | string | **外部交易ID**（如果提供）或内部ID |
| `transferStatus` | string | 提现状态：`0`=申请成功，`1`=提现成功，`2`=转账失败 |
| `sign` | string | MD5签名 |

#### 回调示例

```json
{
  "address": "0xe962856664ed05cc0aace18ae83c444d75bfc9c6",
  "amount": "1.000000",
  "hash": "0xb8e43396852e623450b33a264fe67f8b282b7b1d8c678d4c19b38829a396479b",
  "timestamp": "1757918445123",
  "transId": "EXT_TXN_20250915_001",
  "transferStatus": "1",
  "sign": "A1B2C3D4E5F6789..."
}
```

#### 签名验证

```javascript
const crypto = require('crypto');

function verifyCallbackSignature(payload, secretKey) {
  // 1. 排除sign字段
  const { sign, ...params } = payload;
  
  // 2. 按key排序并拼接
  const sortedKeys = Object.keys(params).sort();
  const signString = sortedKeys
    .map(key => `${key}=${params[key]}`)
    .join('&') + secretKey;
  
  // 3. 生成MD5签名并转大写
  const expectedSign = crypto
    .createHash('md5')
    .update(signString)
    .digest('hex')
    .toUpperCase();
  
  return sign === expectedSign;
}
```

## 重试机制

### 提现回调重试

- **重试条件**: 回调发送失败（网络错误、超时、非2xx响应）
- **重试间隔**: 每30秒重试一次
- **最大重试**: 20次
- **去重机制**: 基于 `transId` + `transferStatus` 去重，避免重复处理

### 监控回调重试

```bash
# 查看重试日志
pm2 logs bsc-scanner | grep "回调重试"

# 查看添加到重试队列的回调
pm2 logs bsc-scanner | grep "添加回调到重试队列"

# 查看重试成功的回调
pm2 logs bsc-scanner | grep "回调重试成功"
```

## 数据库查询

### 查询提现记录

```javascript
// 根据外部交易ID查询
db.withdrawalrecords.find({transId: "EXT_TXN_20250915_001"}).pretty()

// 查询待重试的回调
db.pendingcallbacks.find({
  type: "withdrawal",
  status: "pending"
}).pretty()

// 根据外部交易ID查询相关回调
db.pendingcallbacks.find({
  type: "withdrawal",
  "payload.transId": "EXT_TXN_20250915_001"
}).pretty()
```

## 完整流程示例

```javascript
const axios = require('axios');

async function withdrawalExample() {
  try {
    // 1. 创建提现请求
    const externalTransId = `ORDER_${Date.now()}`;
    
    const response = await axios.post('/api/withdrawal/create', {
      toAddress: '0xe962856664ed05cc0aace18ae83c444d75bfc9c6',
      amount: '10.0', // 10 USDT
      userId: 'user_12345',
      transId: externalTransId // 重要：外部交易ID
    });
    
    console.log('提现请求创建:', response.data);
    
    // 2. 等待回调通知
    // 您的服务器将收到以下回调：
    // - transferStatus: "0" (申请成功)
    // - transferStatus: "1" (提现成功) 或 "2" (提现失败)
    
    // 3. 回调中的 transId 将是您提供的 externalTransId
    
  } catch (error) {
    console.error('提现失败:', error.response?.data || error.message);
  }
}
```

## 关键特性

✅ **外部交易ID支持**: `transId` 参数允许您使用自己的交易标识符  
✅ **可靠回调**: 失败的回调会自动重试，最多20次，每次间隔30秒  
✅ **去重保护**: 防止同一笔提现的重复回调处理  
✅ **签名验证**: MD5签名确保回调数据的完整性  
✅ **灵活金额格式**: 支持wei格式和小数格式的金额输入  
✅ **完整状态跟踪**: 从申请到完成的全流程状态通知  

---

**注意**: 所有金额在内部以wei为单位存储和处理，但在API响应和回调中以USDT格式显示（6位小数）。
