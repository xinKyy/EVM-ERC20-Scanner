#!/bin/bash

# BSC USDT Scanner PM2 启动脚本

echo "🚀 使用PM2启动 BSC USDT Scanner..."

# 检查PM2是否安装
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2未安装，正在安装..."
    npm install -g pm2
    if [ $? -ne 0 ]; then
        echo "❌ PM2安装失败，请手动安装: npm install -g pm2"
        exit 1
    fi
    echo "✅ PM2安装成功"
fi

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

# 创建日志目录
if [ ! -d "logs" ]; then
    echo "📁 创建日志目录..."
    mkdir -p logs
fi

# 检查.env文件
if [ ! -f ".env" ]; then
    echo "⚠️  未找到.env文件，将使用默认配置"
    echo "💡 建议复制.env.example为.env并修改配置"
fi

# 编译TypeScript
echo "🔨 编译TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ TypeScript编译失败"
    exit 1
fi

# 停止已存在的进程
echo "🛑 停止已存在的进程..."
pm2 stop bsc-scanner 2>/dev/null || true
pm2 delete bsc-scanner 2>/dev/null || true

# 启动PM2进程
echo "🎯 启动PM2进程..."
pm2 start ecosystem.config.js

if [ $? -eq 0 ]; then
    echo "✅ BSC USDT Scanner 已成功启动"
    echo ""
    echo "📊 进程状态:"
    pm2 status
    echo ""
    echo "📋 常用命令:"
    echo "   查看状态: pm2 status"
    echo "   查看日志: pm2 logs bsc-scanner"
    echo "   重启服务: pm2 restart bsc-scanner"
    echo "   停止服务: pm2 stop bsc-scanner"
    echo "   删除服务: pm2 delete bsc-scanner"
    echo "   监控面板: pm2 monit"
    echo ""
    echo "📝 日志文件:"
    echo "   应用日志: ./logs/scanner.log"
    echo "   错误日志: ./logs/scanner-error.log"
    echo ""
    echo "🎉 服务已在后台运行！"
else
    echo "❌ 启动失败，请检查配置"
    exit 1
fi
