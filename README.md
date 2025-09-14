# BSC USDT 充值检测服务

基于BSC链的USDT合约充值检测服务，支持实时监控USDT转账事件并通过Webhook通知。

## 功能特性

- ✅ 支持配置BSC RPC和USDT合约地址
- ✅ 使用MongoDB作为数据库服务
- ✅ 地址订阅接口，支持地址去重存储
- ✅ 实时扫描USDT Transfer事件
- ✅ 6个区块确认机制
- ✅ Webhook通知功能
- ✅ 漏块重扫机制
- ✅ 使用ES6语法和TypeScript

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 文件为 `.env` 并修改配置：

```bash
# BSC RPC配置
BSC_RPC_URL=https://bsc-dataseed1.binance.org/
BSC_WS_URL=wss://bsc-ws-node.nariox.org:443

# USDT合约地址 (BSC主网)
USDT_CONTRACT_ADDRESS=0x55d398326f99059fF775485246999027B3197955

# MongoDB配置
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=spk-dev

# 扫描配置
START_BLOCK_NUMBER=34000000
CONFIRMATION_BLOCKS=6
SCAN_INTERVAL=3000

# Webhook配置
WEBHOOK_URL=http://localhost:8080/webhook/transfer  # 传统转账通知（兼容性）
WEBHOOK_SECRET=your_webhook_secret

# 新的回调接口配置
DEPOSIT_CALLBACK_URL=http://localhost:8080/server/wallet/deposit/callback    # 充值回调
WITHDRAWAL_CALLBACK_URL=http://localhost:8080/server/wallet/transfer/callback # 提现回调

# 服务配置
PORT=3000

# 日志级别
LOG_LEVEL=info
```

### 3. 启动MongoDB

确保MongoDB服务正在运行：

```bash
# 使用Docker启动MongoDB
docker run -d --name mongodb -p 27017:27017 mongo:latest

# 或使用本地MongoDB服务
sudo systemctl start mongod
```

**MongoDB配置说明：**
- `MONGODB_URI`: MongoDB连接地址（不包含数据库名）
- `MONGODB_DATABASE`: 数据库名称，默认为 `spk-dev`

**支持的URI格式：**
```bash
# 本地MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=spk-dev

# MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net
MONGODB_DATABASE=spk-dev

# 带认证的MongoDB
MONGODB_URI=mongodb://username:password@localhost:27017
MONGODB_DATABASE=spk-dev
```

### 4. 编译并启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

## API接口

### 地址管理

#### 订阅地址
```http
POST /api/address/subscribe
Content-Type: application/json

{
  "addresses": [
    "0x1234567890123456789012345678901234567890",
    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
  ]
}
```

#### 取消订阅地址
```http
POST /api/address/unsubscribe
Content-Type: application/json

{
  "addresses": [
    "0x1234567890123456789012345678901234567890"
  ]
}
```

#### 获取地址列表
```http
GET /api/address/list?page=1&limit=50
```

#### 检查地址订阅状态
```http
GET /api/address/check/0x1234567890123456789012345678901234567890
```

#### 获取地址统计
```http
GET /api/address/statistics
```

### 扫描服务管理

#### 获取扫描状态
```http
GET /api/scanner/status
```

#### 启动扫描服务
```http
POST /api/scanner/start
```

#### 停止扫描服务
```http
POST /api/scanner/stop
```

#### 手动触发扫描
```http
POST /api/scanner/manual-scan
```

#### 重扫指定区块
```http
POST /api/scanner/rescan
Content-Type: application/json

{
  "fromBlock": 34000000,
  "toBlock": 34000100
}
```

### Transfer记录查询

#### 获取Transfer统计
```http
GET /api/transfer/statistics
```

#### 根据地址查询Transfer
```http
GET /api/transfer/address/0x1234567890123456789012345678901234567890?page=1&limit=50
```

#### 根据区块范围查询Transfer
```http
GET /api/transfer/blocks?fromBlock=34000000&toBlock=34000100
```

## Webhook通知

系统支持两种类型的回调通知：

### 1. 充值回调（新版）

当检测到用户钱包收到USDT转账时，系统会向 `DEPOSIT_CALLBACK_URL` 发送充值通知：

```json
{
  "amount": "100.000000",
  "currency": "USDT",
  "fromAddress": "0x1234567890123456789012345678901234567890",
  "hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "sign": "A1B2C3D4E5F6789012345678901234567890",
  "timestamp": "1694620800000",
  "toAddress": "0x0987654321098765432109876543210987654321",
  "userId": "user_12345",
  "walletType": "1"
}
```

### 2. 提现回调（新版）

提现操作的各个状态都会发送回调通知到 `WITHDRAWAL_CALLBACK_URL`：

```json
{
  "address": "0x0987654321098765432109876543210987654321",
  "amount": "50.000000",
  "hash": "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
  "sign": "F1E2D3C4B5A6789012345678901234567890",
  "timestamp": "1694620900000",
  "transId": "64f8b2c3d4e5f6a7b8c9d0e1",
  "transferStatus": "1"
}
```

**transferStatus 说明：**
- `0`: 提现申请成功
- `1`: 提现成功
- `2`: 转账失败

### 3. 传统转账通知（兼容性）

对于非用户钱包地址的转账，仍使用传统格式发送到 `WEBHOOK_URL`：

```json
{
  "type": "usdt_transfer",
  "data": {
    "transactionHash": "0x...",
    "blockNumber": 34000123,
    "fromAddress": "0x...",
    "toAddress": "0x...",
    "amount": "1000000000000000000000",
    "amountFormatted": "1000.000000",
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "signature": "hmac_sha256_signature"
}
```

### 签名验证

#### 1. 新版回调签名验证（充值和提现回调）

新版回调使用MD5签名，签名包含在请求体的 `sign` 字段中：

```javascript
const crypto = require('crypto');

function verifyCallbackSignature(payload, secret) {
  // 排除sign字段，按字母顺序排序参数
  const params = Object.keys(payload)
    .filter(key => key !== 'sign')
    .sort()
    .map(key => `${key}=${payload[key]}`)
    .join('&');
  
  // 添加密钥
  const signString = params + '&key=' + secret;
  
  // 生成MD5签名并转大写
  const expectedSign = crypto.createHash('md5').update(signString).digest('hex').toUpperCase();
  
  return payload.sign === expectedSign;
}

// 使用示例
const payload = {
  amount: '100.000000',
  currency: 'USDT',
  fromAddress: '0x1234567890123456789012345678901234567890',
  hash: '0xabcdef...',
  timestamp: '1694620800000',
  toAddress: '0x0987654321098765432109876543210987654321',
  userId: 'user_12345',
  walletType: '1',
  sign: 'A1B2C3D4E5F6789012345678901234567890'
};

const isValid = verifyCallbackSignature(payload, 'your_webhook_secret');
```

#### 2. 传统签名验证（兼容性）

传统转账通知使用HMAC-SHA256签名，签名在请求头的 `X-Signature` 字段中：

```javascript
const crypto = require('crypto');

function verifySignature(data, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(data))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

## 项目结构

```
src/
├── config/              # 配置文件
├── controllers/         # 控制器
├── database/           # 数据库连接
├── middleware/         # 中间件
├── models/             # 数据模型
├── routes/             # 路由定义
├── services/           # 业务服务
├── app.ts              # 应用主文件
└── index.ts            # 入口文件
```

## 数据库模型

### Address (地址表)
- `address`: 地址 (唯一索引)
- `createdAt`: 创建时间
- `updatedAt`: 更新时间

### Transfer (转账表)
- `transactionHash`: 交易哈希 (唯一索引)
- `blockNumber`: 区块号
- `fromAddress`: 发送地址
- `toAddress`: 接收地址
- `amount`: 转账数量 (wei)
- `amountFormatted`: 格式化的USDT数量
- `status`: 状态 (pending/confirmed/failed)
- `confirmationCount`: 确认数量
- `webhookSent`: 是否已发送Webhook
- `webhookSentAt`: Webhook发送时间

### ScanState (扫描状态表)
- `lastScannedBlock`: 最后扫描的区块号
- `lastScanTime`: 最后扫描时间
- `isScanning`: 是否正在扫描

## 监控和日志

服务提供详细的日志输出，包括：
- 扫描进度
- 发现的Transfer事件
- Webhook发送状态
- 错误和异常信息

可通过以下接口监控服务状态：
- `GET /api/health` - 健康检查
- `GET /api/scanner/status` - 扫描状态
- `GET /api/transfer/statistics` - Transfer统计

## 注意事项

1. **网络配置**: 确保BSC RPC节点稳定可用
2. **区块确认**: 默认需要6个区块确认，可根据需要调整
3. **扫描间隔**: 默认3秒扫描一次，避免过于频繁请求
4. **数据备份**: 定期备份MongoDB数据
5. **Webhook重试**: 建议在Webhook接收端实现重试机制
6. **资源监控**: 监控内存和CPU使用情况

## 部署建议

### Docker部署

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
EXPOSE 3000

CMD ["npm", "start"]
```

### PM2部署

```json
{
  "name": "bsc-scanner",
  "script": "dist/index.js",
  "instances": 1,
  "env": {
    "NODE_ENV": "production"
  },
  "log_date_format": "YYYY-MM-DD HH:mm:ss Z",
  "error_file": "logs/error.log",
  "out_file": "logs/out.log"
}
```

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查MongoDB服务是否运行
   - 验证连接字符串是否正确

2. **RPC连接失败**
   - 检查BSC RPC节点是否可用
   - 尝试更换RPC节点

3. **扫描滞后**
   - 检查网络连接
   - 调整扫描间隔
   - 考虑使用WebSocket连接

4. **Webhook发送失败**
   - 检查目标URL是否可访问
   - 验证签名配置
   - 查看错误日志

## 许可证

MIT License
