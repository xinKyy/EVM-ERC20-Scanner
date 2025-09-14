# PM2 使用指南

## 快速开始

### 1. 安装PM2（如果未安装）
```bash
npm install -g pm2
```

### 2. 启动服务
```bash
# 方式1: 使用启动脚本（推荐）
./scripts/pm2-start.sh

# 方式2: 使用npm命令
npm run deploy

# 方式3: 手动启动
npm run build
pm2 start ecosystem.config.js
```

## 常用命令

### 进程管理
```bash
# 查看所有进程状态
pm2 status

# 查看详细信息
pm2 show bsc-scanner

# 重启服务
pm2 restart bsc-scanner

# 停止服务
pm2 stop bsc-scanner

# 删除服务
pm2 delete bsc-scanner

# 重载服务（0秒停机）
pm2 reload bsc-scanner
```

### 日志管理
```bash
# 查看实时日志
pm2 logs bsc-scanner

# 查看最近100行日志
pm2 logs bsc-scanner --lines 100

# 只查看错误日志
pm2 logs bsc-scanner --err

# 清空日志
pm2 flush

# 查看日志文件位置
ls -la logs/
```

### 监控
```bash
# 打开监控面板
pm2 monit

# 查看内存和CPU使用情况
pm2 status
```

## 日志文件

- **应用日志**: `./logs/scanner.log` - 包含所有应用输出
- **错误日志**: `./logs/scanner-error.log` - 只包含错误信息

## 环境配置

PM2会自动读取`.env`文件中的环境变量。支持的环境：

- `development`: 开发环境
- `production`: 生产环境（默认）

```bash
# 使用特定环境启动
pm2 start ecosystem.config.js --env development
pm2 start ecosystem.config.js --env production
```

## 开机自启动

```bash
# 保存当前PM2进程列表
pm2 save

# 生成开机启动脚本
pm2 startup

# 按照提示执行生成的命令（通常需要sudo）
```

## 故障排除

### 1. 服务无法启动
```bash
# 检查编译是否成功
npm run build

# 检查配置文件
node -e "console.log(require('./ecosystem.config.js'))"

# 查看详细错误
pm2 logs bsc-scanner --err
```

### 2. 内存泄漏
```bash
# 查看内存使用情况
pm2 monit

# 设置内存限制重启（已在配置中设置为1G）
# 当内存超过1G时会自动重启
```

### 3. 日志文件过大
```bash
# 安装日志轮转插件
pm2 install pm2-logrotate

# 配置日志轮转
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## 高级配置

### 集群模式
如果需要运行多个实例：

```javascript
// 修改 ecosystem.config.js
{
  instances: 'max', // 或具体数字，如 4
  exec_mode: 'cluster'
}
```

### 自定义环境变量
```javascript
// 在 ecosystem.config.js 中添加
env_custom: {
  NODE_ENV: 'custom',
  PORT: 8080,
  CUSTOM_VAR: 'value'
}
```

然后使用：
```bash
pm2 start ecosystem.config.js --env custom
```
