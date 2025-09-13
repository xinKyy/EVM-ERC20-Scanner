import { App } from './app';
import { scannerService, withdrawalService } from './routes/scanner';

async function bootstrap() {
  const app = new App();

  // 处理进程信号
  process.on('SIGTERM', async () => {
    console.log('收到SIGTERM信号，开始优雅关闭...');
    await scannerService.stopScanning();
    await app.gracefulShutdown();
  });

  process.on('SIGINT', async () => {
    console.log('收到SIGINT信号，开始优雅关闭...');
    await scannerService.stopScanning();
    await app.gracefulShutdown();
  });

  // 处理未捕获的异常
  process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason, 'at:', promise);
    process.exit(1);
  });

  try {
    // 启动应用
    await app.listen();
    
    // 等待一段时间后自动启动服务
    console.log('\n⏳ 5秒后自动启动服务...');
    setTimeout(async () => {
      try {
        // 启动扫描服务
        await scannerService.startScanning();
        console.log('✅ 扫描服务已自动启动');
        
        // 启动提现处理服务
        await withdrawalService.startWithdrawalProcessor();
        console.log('✅ 提现处理服务已启动');
      } catch (error) {
        console.error('❌ 自动启动服务失败:', error);
        console.log('💡 您可以手动调用相关API启动服务');
      }
    }, 5000);

  } catch (error) {
    console.error('启动应用失败:', error);
    process.exit(1);
  }
}

// 启动应用
bootstrap().catch((error) => {
  console.error('应用启动失败:', error);
  process.exit(1);
});
