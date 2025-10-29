#!/usr/bin/env node

/**
 * 内存监控脚本
 * 监控应用的内存使用情况，并在内存过高时发出警告
 */

const fs = require('fs');
const path = require('path');

class MemoryMonitor {
  constructor() {
    this.logFile = path.join(__dirname, '../logs/memory-monitor.log');
    this.warningThreshold = 2 * 1024 * 1024 * 1024; // 2GB
    this.criticalThreshold = 3 * 1024 * 1024 * 1024; // 3GB
    this.checkInterval = 30000; // 30秒检查一次
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: usage.rss, // 常驻集大小
      heapTotal: usage.heapTotal, // 堆总大小
      heapUsed: usage.heapUsed, // 堆已使用
      external: usage.external, // 外部内存
      arrayBuffers: usage.arrayBuffers, // ArrayBuffer内存
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 格式化字节数
   */
  formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * 记录内存使用情况
   */
  logMemoryUsage(usage, level = 'INFO') {
    const logEntry = {
      timestamp: usage.timestamp,
      level,
      rss: this.formatBytes(usage.rss),
      heapTotal: this.formatBytes(usage.heapTotal),
      heapUsed: this.formatBytes(usage.heapUsed),
      external: this.formatBytes(usage.external),
      arrayBuffers: this.formatBytes(usage.arrayBuffers),
      heapUsedPercent: Math.round((usage.heapUsed / usage.heapTotal) * 100),
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    
    // 输出到控制台
    console.log(`[${level}] Memory Usage: RSS=${logEntry.rss}, Heap=${logEntry.heapUsed}/${logEntry.heapTotal} (${logEntry.heapUsedPercent}%)`);
    
    // 写入日志文件
    try {
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('写入内存监控日志失败:', error);
    }
  }

  /**
   * 检查内存使用情况并发出警告
   */
  checkMemoryUsage() {
    const usage = this.getMemoryUsage();
    let level = 'INFO';

    if (usage.rss > this.criticalThreshold) {
      level = 'CRITICAL';
      console.error(`🚨 CRITICAL: 内存使用过高! RSS: ${this.formatBytes(usage.rss)}`);
      this.triggerGarbageCollection();
    } else if (usage.rss > this.warningThreshold) {
      level = 'WARNING';
      console.warn(`⚠️  WARNING: 内存使用较高! RSS: ${this.formatBytes(usage.rss)}`);
    }

    this.logMemoryUsage(usage, level);
    return usage;
  }

  /**
   * 触发垃圾回收（如果可用）
   */
  triggerGarbageCollection() {
    if (global.gc) {
      console.log('🗑️  触发垃圾回收...');
      global.gc();
      
      // 垃圾回收后再次检查内存
      setTimeout(() => {
        const afterGC = this.getMemoryUsage();
        console.log(`垃圾回收后内存: RSS=${this.formatBytes(afterGC.rss)}`);
        this.logMemoryUsage(afterGC, 'GC_AFTER');
      }, 1000);
    } else {
      console.log('垃圾回收不可用，请使用 --expose-gc 启动应用');
    }
  }

  /**
   * 启动监控
   */
  start() {
    console.log('🔍 启动内存监控...');
    console.log(`警告阈值: ${this.formatBytes(this.warningThreshold)}`);
    console.log(`危险阈值: ${this.formatBytes(this.criticalThreshold)}`);
    console.log(`检查间隔: ${this.checkInterval / 1000}秒`);
    console.log(`日志文件: ${this.logFile}`);
    
    // 立即检查一次
    this.checkMemoryUsage();
    
    // 设置定期检查
    setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkInterval);
  }

  /**
   * 生成内存使用报告
   */
  generateReport(hours = 24) {
    try {
      const logContent = fs.readFileSync(this.logFile, 'utf8');
      const lines = logContent.trim().split('\n');
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const recentEntries = lines
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(entry => entry && new Date(entry.timestamp) > cutoffTime);

      if (recentEntries.length === 0) {
        console.log('没有找到最近的内存监控数据');
        return;
      }

      const rssValues = recentEntries.map(e => this.parseBytes(e.rss));
      const heapUsedValues = recentEntries.map(e => this.parseBytes(e.heapUsed));
      
      const report = {
        period: `最近${hours}小时`,
        totalEntries: recentEntries.length,
        rss: {
          min: this.formatBytes(Math.min(...rssValues)),
          max: this.formatBytes(Math.max(...rssValues)),
          avg: this.formatBytes(rssValues.reduce((a, b) => a + b, 0) / rssValues.length),
        },
        heapUsed: {
          min: this.formatBytes(Math.min(...heapUsedValues)),
          max: this.formatBytes(Math.max(...heapUsedValues)),
          avg: this.formatBytes(heapUsedValues.reduce((a, b) => a + b, 0) / heapUsedValues.length),
        },
        warnings: recentEntries.filter(e => e.level === 'WARNING').length,
        criticals: recentEntries.filter(e => e.level === 'CRITICAL').length,
      };

      console.log('\n📊 内存使用报告:');
      console.log(JSON.stringify(report, null, 2));
      
    } catch (error) {
      console.error('生成内存报告失败:', error);
    }
  }

  /**
   * 解析字节字符串为数字
   */
  parseBytes(str) {
    const match = str.match(/^([\d.]+)\s*(\w+)$/);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    const multipliers = {
      'BYTES': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
    };
    
    return value * (multipliers[unit] || 1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const monitor = new MemoryMonitor();
  
  // 处理命令行参数
  const args = process.argv.slice(2);
  
  if (args.includes('--report')) {
    const hours = parseInt(args[args.indexOf('--report') + 1]) || 24;
    monitor.generateReport(hours);
  } else {
    monitor.start();
    
    // 优雅退出处理
    process.on('SIGINT', () => {
      console.log('\n👋 内存监控已停止');
      process.exit(0);
    });
  }
}

module.exports = MemoryMonitor;
