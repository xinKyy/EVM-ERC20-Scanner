#!/bin/bash

# BSC USDT Scanner 启动脚本

echo "🚀 启动 BSC USDT Scanner..."

# 检查Node.js版本
NODE_VERSION=$(node --version 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "❌ 未找到Node.js，请先安装Node.js 16+"
    exit 1
fi

echo "✅ Node.js版本: $NODE_VERSION"

# 检查npm依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖包..."
    npm install
fi

# 检查.env文件
if [ ! -f ".env" ]; then
    echo "⚠️  未找到.env文件，将使用默认配置"
    echo "💡 建议复制.env.example为.env并修改配置"
fi

# 检查MongoDB连接
echo "🔍 检查MongoDB连接..."
MONGODB_URI=${MONGODB_URI:-"mongodb://localhost:27017"}
MONGODB_DATABASE=${MONGODB_DATABASE:-"spk-dev"}

# 尝试连接MongoDB
if command -v mongosh >/dev/null 2>&1; then
    mongosh --eval "db.runCommand('ping')" "$MONGODB_URI/$MONGODB_DATABASE" >/dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ MongoDB连接正常"
    else
        echo "❌ MongoDB连接失败"
        echo "💡 请确保MongoDB服务正在运行"
        echo "   Docker: docker run -d --name mongodb -p 27017:27017 mongo:latest"
        echo "   或启动本地MongoDB服务"
    fi
else
    echo "⚠️  无法检查MongoDB连接（未安装mongosh）"
fi

# 编译TypeScript（如果需要）
echo "🔨 编译TypeScript..."
npm run build

# 启动服务
echo "🎯 启动服务..."
if [ "$1" = "dev" ]; then
    echo "开发模式启动..."
    npm run dev
else
    echo "生产模式启动..."
    npm start
fi
