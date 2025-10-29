import { ScannerService } from './ScannerService';

/**
 * 全局服务管理器
 * 用于管理和协调各个服务之间的通信
 */
export class ServiceManager {
  private static instance: ServiceManager;
  private scannerService: ScannerService | null = null;

  private constructor() {}

  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  /**
   * 设置扫描服务实例
   */
  public setScannerService(scannerService: ScannerService): void {
    this.scannerService = scannerService;
    console.log('ServiceManager: 扫描服务已注册');
  }

  /**
   * 获取扫描服务实例
   */
  public getScannerService(): ScannerService | null {
    return this.scannerService;
  }

  /**
   * 通知新钱包地址创建
   */
  public notifyNewWalletAddress(address: string): void {
    if (this.scannerService) {
      this.scannerService.addNewWalletAddress(address);
      console.log(`ServiceManager: 已通知扫描服务新钱包地址 ${address}`);
    } else {
      console.warn(`ServiceManager: 扫描服务未初始化，无法通知新钱包地址 ${address}`);
    }
  }

  /**
   * 通知钱包地址移除
   */
  public notifyWalletAddressRemoved(address: string): void {
    if (this.scannerService) {
      this.scannerService.removeWalletAddress(address);
      console.log(`ServiceManager: 已通知扫描服务移除钱包地址 ${address}`);
    } else {
      console.warn(`ServiceManager: 扫描服务未初始化，无法通知移除钱包地址 ${address}`);
    }
  }
}
