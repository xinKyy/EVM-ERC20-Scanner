import Web3 from 'web3';
import { config } from '../config';

/**
 * Web3连接池管理器
 * 复用Web3连接，减少内存占用
 */
export class Web3Pool {
  private static instance: Web3Pool;
  private web3Instance: Web3;
  private connectionCount: number = 0;
  private maxConnections: number = 5;

  private constructor() {
    this.web3Instance = new Web3(config.bsc.rpcUrl);
    this.setupConnectionMonitoring();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): Web3Pool {
    if (!Web3Pool.instance) {
      Web3Pool.instance = new Web3Pool();
    }
    return Web3Pool.instance;
  }

  /**
   * 获取Web3实例（简化版，减少开销）
   */
  public getWeb3(): Web3 {
    return this.web3Instance;
  }

  /**
   * 释放连接（简化为空操作，减少开销）
   */
  public releaseConnection(): void {
    // 简化为空操作，减少性能开销
  }

  /**
   * 重新连接
   */
  public async reconnect(): Promise<void> {
    try {
      // 创建新的Web3实例
      this.web3Instance = new Web3(config.bsc.rpcUrl);
      
      // 测试连接
      await this.web3Instance.eth.getBlockNumber();
      console.log('Web3连接池重连成功');
    } catch (error) {
      console.error('Web3连接池重连失败:', error);
      throw error;
    }
  }

  /**
   * 检查连接状态
   */
  public async checkConnection(): Promise<boolean> {
    try {
      await this.web3Instance.eth.getBlockNumber();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 设置连接监控
   */
  private setupConnectionMonitoring(): void {
    // 每5分钟检查一次连接状态
    setInterval(async () => {
      const isConnected = await this.checkConnection();
      if (!isConnected) {
        console.warn('Web3连接断开，尝试重连...');
        try {
          await this.reconnect();
        } catch (error) {
          console.error('Web3自动重连失败:', error);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * 获取连接统计信息
   */
  public getStats(): {
    activeConnections: number;
    maxConnections: number;
  } {
    return {
      activeConnections: this.connectionCount,
      maxConnections: this.maxConnections,
    };
  }
}
