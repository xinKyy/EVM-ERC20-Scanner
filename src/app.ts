import express from 'express';
import cors from 'cors';
import { DatabaseConnection } from './database/connection';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger, corsMiddleware } from './middleware/requestLogger';
import { config } from './config';

export class App {
  public app: express.Application;
  private dbConnection: DatabaseConnection;

  constructor() {
    this.app = express();
    this.dbConnection = DatabaseConnection.getInstance();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  /**
   * 初始化中间件
   */
  private initializeMiddlewares(): void {
    // 请求日志中间件
    this.app.use(requestLogger);

    // CORS中间件
    this.app.use(corsMiddleware);
    this.app.use(cors());

    // JSON解析中间件
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 安全头
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });
  }

  /**
   * 初始化路由
   */
  private initializeRoutes(): void {
    // 根路径重定向到API信息
    this.app.get('/', (req, res) => {
      res.redirect('/api/info');
    });

    // API路由
    this.app.use('/api', routes);
  }

  /**
   * 初始化错误处理
   */
  private initializeErrorHandling(): void {
    // 404处理
    this.app.use(notFoundHandler);
    
    // 全局错误处理
    this.app.use(errorHandler);
  }

  /**
   * 连接数据库
   */
  public async connectDatabase(): Promise<void> {
    try {
      await this.dbConnection.connect();
      console.log('数据库连接成功');
    } catch (error) {
      console.error('数据库连接失败:', error);
      throw error;
    }
  }

  /**
   * 断开数据库连接
   */
  public async disconnectDatabase(): Promise<void> {
    try {
      await this.dbConnection.disconnect();
      console.log('数据库连接已关闭');
    } catch (error) {
      console.error('关闭数据库连接失败:', error);
    }
  }

  /**
   * 启动服务器
   */
  public async listen(): Promise<void> {
    try {
      // 先连接数据库
      await this.connectDatabase();

      // 启动HTTP服务器
      const port = config.server.port;
      
      this.app.listen(port, () => {
        console.log(`\n🚀 BSC USDT Scanner服务已启动`);
        console.log(`📡 服务地址: http://localhost:${port}`);
        console.log(`📊 API文档: http://localhost:${port}/api/info`);
        console.log(`❤️  健康检查: http://localhost:${port}/api/health`);
        console.log(`🔧 配置信息:`);
        console.log(`   - BSC RPC: ${config.bsc.rpcUrl}`);
        console.log(`   - USDT合约: ${config.usdt.contractAddress}`);
        console.log(`   - MongoDB: ${config.mongodb.uri}`);
        console.log(`   - Webhook: ${config.webhook.url}`);
        console.log(`   - 起始区块: ${config.scanner.startBlockNumber}`);
        console.log(`   - 确认区块数: ${config.scanner.confirmationBlocks}`);
        console.log(`\n🎯 可用接口:`);
        console.log(`   POST /api/address/subscribe    - 订阅地址`);
        console.log(`   GET  /api/scanner/status       - 获取扫描状态`);
        console.log(`   POST /api/scanner/start        - 启动扫描`);
        console.log(`   POST /api/scanner/stop         - 停止扫描`);
        console.log(`\n服务已就绪，等待请求...`);
      });

    } catch (error) {
      console.error('启动服务器失败:', error);
      process.exit(1);
    }
  }

  /**
   * 优雅关闭
   */
  public async gracefulShutdown(): Promise<void> {
    console.log('\n正在优雅关闭服务...');
    
    try {
      await this.disconnectDatabase();
      console.log('服务已优雅关闭');
      process.exit(0);
    } catch (error) {
      console.error('关闭服务时出错:', error);
      process.exit(1);
    }
  }
}
