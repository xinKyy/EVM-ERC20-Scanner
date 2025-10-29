import mongoose from 'mongoose';
import { config } from '../config';

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private isConnected: boolean = false;

  private constructor() {}

  /**
   * 构建MongoDB URI
   * @returns 完整的MongoDB连接字符串
   */
  private buildMongoUri(): string {
    const baseUri = config.mongodb.uri;
    const database = config.mongodb.database;

    // 如果URI已经包含数据库名，则直接使用
    if (baseUri.includes('mongodb://') && baseUri.split('/').length > 3) {
      return baseUri;
    }
    
    // 如果URI是MongoDB Atlas格式（包含查询参数）
    if (baseUri.includes('?')) {
      const [uriPart, queryPart] = baseUri.split('?');
      // 确保不会有双斜杠
      const cleanUriPart = uriPart.endsWith('/') ? uriPart.slice(0, -1) : uriPart;
      return `${cleanUriPart}/${database}?${queryPart}`;
    }
    
    // 标准格式：添加数据库名
    const cleanBaseUri = baseUri.endsWith('/') ? baseUri.slice(0, -1) : baseUri;
    return `${cleanBaseUri}/${database}`;
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('数据库已连接');
      return;
    }

    try {
      // 构建完整的MongoDB URI
      const mongoUri = this.buildMongoUri();
      
      await mongoose.connect(mongoUri, {
        maxPoolSize: 50,           // 增加连接池大小
        minPoolSize: 5,            // 设置最小连接数
        maxIdleTimeMS: 30000,      // 连接空闲时间
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferMaxEntries: 0,       // 禁用mongoose缓冲
        bufferCommands: false,     // 禁用命令缓冲
      });

      this.isConnected = true;
      console.log(`MongoDB连接成功 - 数据库: ${config.mongodb.database}`);

      mongoose.connection.on('error', (error) => {
        console.error('MongoDB连接错误:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB连接断开');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('MongoDB重新连接');
        this.isConnected = true;
      });

    } catch (error) {
      console.error('MongoDB连接失败:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('MongoDB连接已关闭');
    } catch (error) {
      console.error('关闭MongoDB连接时出错:', error);
      throw error;
    }
  }

  public isConnectionActive(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }
}
