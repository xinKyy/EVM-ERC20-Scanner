import { BlockchainService, TransferEvent } from './BlockchainService';
import { TransferService } from './TransferService';
import { AddressService } from './AddressService';
import { WebhookService } from './WebhookService';
import { WalletService } from './WalletService';
import { CollectionService } from './CollectionService';
import { CacheService } from './CacheService';
import { ScanState, IScanState } from '../models';
import { config } from '../config';

export class ScannerService {
  private blockchainService: BlockchainService;
  private transferService: TransferService;
  private addressService: AddressService;
  private webhookService: WebhookService;
  private walletService: WalletService;
  private collectionService: CollectionService;
  private cacheService: CacheService;
  private isScanning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private confirmationInterval: NodeJS.Timeout | null = null;
  private webhookInterval: NodeJS.Timeout | null = null;
  private lastHealthCheck: Date = new Date();
  private isScanningBlocks: boolean = false; // 添加扫描锁
  private lastScanDuration: number = 0; // 记录上次扫描耗时

  constructor() {
    this.blockchainService = new BlockchainService();
    this.transferService = new TransferService();
    this.addressService = new AddressService();
    this.webhookService = new WebhookService();
    this.walletService = new WalletService();
    this.collectionService = new CollectionService();
    this.cacheService = CacheService.getInstance();
  }

  /**
   * 启动扫描服务
   */
  public async startScanning(): Promise<void> {
    if (this.isScanning) {
      console.log('扫描服务已在运行中');
      return;
    }

    try {
      console.log('启动BSC USDT转账扫描服务...');

      // 检查区块链连接
      const isConnected = await this.blockchainService.checkConnection();
      if (!isConnected) {
        throw new Error('无法连接到BSC网络');
      }

      // 初始化扫描状态
      await this.initializeScanState();

      this.isScanning = true;
      console.log('扫描服务启动成功');

      // 开始主扫描循环
      this.startScanLoop();

      // 开始Webhook处理循环
      this.startWebhookLoop();

      // 开始确认处理循环
      this.startConfirmationLoop();

      // 启动资金归集服务
      if (config.collection.enabled) {
        await this.collectionService.startAutoCollection();
      }

      // 启动回调重试处理器
      this.webhookService.startCallbackRetryProcessor();

    } catch (error) {
      console.error('启动扫描服务失败:', error);
      throw error;
    }
  }

  /**
   * 停止扫描服务
   */
  public async stopScanning(): Promise<void> {
    console.log('正在停止扫描服务...');

    this.isScanning = false;

    // 清理所有定时器，防止内存泄漏
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    if (this.confirmationInterval) {
      clearInterval(this.confirmationInterval);
      this.confirmationInterval = null;
    }

    if (this.webhookInterval) {
      clearInterval(this.webhookInterval);
      this.webhookInterval = null;
    }

    // 清理缓存
    this.cacheService.clear();

    // 更新扫描状态
    await this.updateScanState(false);

    console.log('扫描服务已停止');
  }

  /**
   * 初始化扫描状态
   */
  private async initializeScanState(): Promise<void> {
    try {
      let scanState = await ScanState.findOne();

      if (!scanState) {
        // 创建初始扫描状态
        scanState = new ScanState({
          lastScannedBlock: config.scanner.startBlockNumber,
          lastScanTime: new Date(),
          isScanning: false,
        });
        await scanState.save();
        console.log(`初始化扫描状态，起始区块: ${config.scanner.startBlockNumber}`);
      }

      // 标记正在扫描
      await this.updateScanState(true);

    } catch (error) {
      console.error('初始化扫描状态失败:', error);
      throw error;
    }
  }

  /**
   * 更新扫描状态
   */
  private async updateScanState(isScanning: boolean, lastScannedBlock?: number): Promise<void> {
    try {
      const updateData: any = {
        isScanning,
        lastScanTime: new Date(),
      };

      if (lastScannedBlock !== undefined) {
        updateData.lastScannedBlock = lastScannedBlock;
      }

      const result = await ScanState.findOneAndUpdate({}, updateData, { upsert: true });

      // 验证更新是否成功
      if (lastScannedBlock !== undefined) {
        console.log(`✅ 扫描状态已更新: lastScannedBlock = ${lastScannedBlock}`);
      }

    } catch (error) {
      console.error('❌ 更新扫描状态失败:', error);
      // 重新抛出异常，确保调用方知道更新失败
      throw new Error(`扫描状态更新失败: ${error.message}`);
    }
  }

  /**
   * 开始主扫描循环
   */
  private startScanLoop(): void {
    const scanBlocks = async () => {
      if (!this.isScanning) return;

      // 🔒 防止并发扫描
      if (this.isScanningBlocks) {
        console.log(`⏳ 上一次扫描仍在进行中，跳过本次扫描 (上次耗时: ${this.lastScanDuration}ms)`);
        return;
      }

      this.isScanningBlocks = true;
      const scanStartTime = Date.now();

      try {
        await this.scanNewBlocks();
      } catch (error) {
        console.error('扫描区块失败:', error);

        // 连接失败时尝试重连
        if (error.message.includes('connection') || error.message.includes('network')) {
          try {
            console.log('尝试重新连接区块链网络...');
            await this.blockchainService.reconnect();
          } catch (reconnectError) {
            console.error('重连失败:', reconnectError);
          }
        }
      } finally {
        this.lastScanDuration = Date.now() - scanStartTime;
        this.isScanningBlocks = false;
        console.log(`📊 本次扫描耗时: ${this.lastScanDuration}ms`);
      }
    };

    // 立即执行一次
    scanBlocks();

    // 设置定时器
    this.scanInterval = setInterval(scanBlocks, config.scanner.scanInterval);
  }

  /**
   * 扫描新区块
   */
  private async scanNewBlocks(): Promise<void> {
    let fromBlock: number = 0;
    let toBlock: number = 0;

    try {
      // 获取当前扫描状态
      const scanState = await ScanState.findOne();
      if (!scanState) {
        throw new Error('找不到扫描状态');
      }

      console.log(`🔍 当前扫描状态: lastScannedBlock=${scanState.lastScannedBlock}, isScanning=${scanState.isScanning}, lastScanTime=${scanState.lastScanTime}`);

      // 获取最新区块号
      const latestBlock = await this.blockchainService.getLatestBlockNumber();
      fromBlock = scanState.lastScannedBlock + 1;

      console.log(`🔍 计算扫描范围: fromBlock=${fromBlock} (lastScannedBlock + 1)`);

      // 确保不会扫描太远未来的区块（避免确认机制问题）
      // 根据上次扫描耗时动态调整批次大小
      let batchSize = 50; // 默认50个区块
      if (this.lastScanDuration > 30000) { // 超过30秒
        batchSize = 20; // 减少到20个区块
      } else if (this.lastScanDuration > 10000) { // 超过10秒
        batchSize = 30; // 减少到30个区块
      } else if (this.lastScanDuration < 5000) { // 少于5秒
        batchSize = 100; // 增加到100个区块
      }

      toBlock = Math.min(
        latestBlock - config.scanner.confirmationBlocks,
        fromBlock + batchSize
      );

      console.log(`📊 动态批次大小: ${batchSize} 个区块 (基于上次耗时: ${this.lastScanDuration}ms)`);

      if (fromBlock > toBlock) {
        // 没有新区块需要扫描
        return;
      }

      console.log(`🔍 扫描区块范围: ${fromBlock} - ${toBlock} (最新区块: ${latestBlock})`);

      // 扫描Transfer事件
      const events = await this.blockchainService.scanTransferEvents(fromBlock, toBlock);

      let targetEvents: TransferEvent[] = [];

      if (events.length > 0) {
        console.log(`发现 ${events.length} 个Transfer事件`);

        // 过滤出目标地址的转账
        console.log(`🔍 开始过滤目标地址...`);
        targetEvents = await this.filterTargetEvents(events);
        console.log(`🔍 过滤完成，找到 ${targetEvents.length} 个目标事件`);

        if (targetEvents.length > 0) {
          console.log(`其中 ${targetEvents.length} 个转账到已订阅地址`);

          // 保存到数据库
          console.log(`🔍 开始保存Transfer事件到数据库...`);
          await this.transferService.batchSaveTransferEvents(
            targetEvents,
            (amount) => this.blockchainService.formatUSDTAmount(amount)
          );
          console.log(`🔍 Transfer事件保存完成`);
        }
      } else {
        console.log(`🔍 未发现Transfer事件`);
      }

      // 🔧 修复：先更新扫描状态，再处理用户钱包余额
      // 这样即使钱包余额更新失败，也不会重复扫描同一区块
      console.log(`🔍 准备更新扫描状态到区块 ${toBlock}...`);
      await this.updateScanState(true, toBlock);
      console.log(`🔍 扫描状态更新完成`);
      this.lastHealthCheck = new Date();

      // 处理用户钱包余额更新（放在扫描状态更新之后）
      // 复用之前过滤的targetEvents，避免重复过滤
      if (targetEvents.length > 0) {
        console.log(`🔍 开始更新用户钱包余额...`);
        // 这里只更新钱包余额，不重复保存Transfer记录
        await this.updateUserWalletBalances(targetEvents);
        console.log(`🔍 用户钱包余额更新完成`);
      }

    } catch (error) {
      console.error('❌ 扫描新区块失败:', error);
      console.error('❌ 错误详情:', {
        message: error.message,
        stack: error.stack,
        fromBlock,
        toBlock: toBlock || 'undefined'
      });
      throw error;
    }
  }

  /**
   * 过滤出转账到目标地址的事件
   */
  private async filterTargetEvents(events: TransferEvent[]): Promise<TransferEvent[]> {
    if (events.length === 0) return [];

    const filterStartTime = Date.now();
    console.log(`🔍 开始过滤 ${events.length} 个事件...`);

    try {
      // 获取所有to地址并去重
      const toAddresses = [...new Set(events.map(event => event.toAddress))];
      console.log(`🔍 去重后有 ${toAddresses.length} 个唯一地址`);

      // 🚀 快速路径：如果地址数量太多，分批处理
      if (toAddresses.length > 1000) {
        console.log(`⚡ 地址数量过多 (${toAddresses.length})，使用分批快速处理...`);
        return await this.filterTargetEventsFast(events, toAddresses);
      }

      // 只对大量地址使用缓存（减少小数据缓存开销）
      if (toAddresses.length > 10) {
        // 生成缓存键
        const cacheKey = CacheService.generateAddressKey(toAddresses, 'target_addresses');

        // 尝试从缓存获取
        let allTargetAddresses = this.cacheService.get(cacheKey);

        if (!allTargetAddresses) {
          console.log(`🔍 缓存未命中，查询数据库...`);
          const queryStart = Date.now();

          // 同时检查订阅地址和用户钱包地址
          const subscribedAddresses = await this.getUserWalletAddresses(toAddresses)

          console.log(`🔍 数据库查询完成，耗时 ${Date.now() - queryStart}ms`);

          // 合并两个地址集合
          allTargetAddresses = new Set([
            ...subscribedAddresses
          ]);

          // 缓存结果（5分钟，延长缓存时间）
          this.cacheService.set(cacheKey, allTargetAddresses, 5 * 60 * 1000);
        } else {
          console.log(`🔍 缓存命中！`);
        }

        // 过滤出目标事件
        const targetEvents = events.filter(event => allTargetAddresses.has(event.toAddress));
        console.log(`🔍 过滤完成，耗时 ${Date.now() - filterStartTime}ms，找到 ${targetEvents.length} 个目标事件`);
        return targetEvents;
      } else {
        // 小数据量直接查询，不使用缓存
        const [subscribedAddresses, userWalletAddresses] = await Promise.all([
          this.addressService.getSubscribedAddresses(toAddresses),
          this.getUserWalletAddresses(toAddresses),
        ]);

        // 合并两个地址集合
        const allTargetAddresses = new Set([
          ...subscribedAddresses,
          ...userWalletAddresses,
        ]);

        // 过滤出目标事件
        const targetEvents = events.filter(event => allTargetAddresses.has(event.toAddress));
        console.log(`🔍 过滤完成，耗时 ${Date.now() - filterStartTime}ms，找到 ${targetEvents.length} 个目标事件`);
        return targetEvents;
      }

    } catch (error) {
      console.error('❌ 过滤目标事件失败:', error);
      return [];
    }
  }

  /**
   * 快速分批过滤大量地址
   */
  private async filterTargetEventsFast(events: TransferEvent[], toAddresses: string[]): Promise<TransferEvent[]> {
    const batchSize = 500; // 每批500个地址
    const allTargetAddresses = new Set<string>();

    console.log(`⚡ 快速分批处理 ${toAddresses.length} 个地址，每批 ${batchSize} 个`);

    // 并发处理多个批次
    const batches = [];
    for (let i = 0; i < toAddresses.length; i += batchSize) {
      const batch = toAddresses.slice(i, i + batchSize);
      batches.push(batch);
    }

    // 限制并发数量为6，避免数据库压力过大
    const concurrency = 6;
    for (let i = 0; i < batches.length; i += concurrency) {
      const currentBatches = batches.slice(i, i + concurrency);

      const batchPromises = currentBatches.map(async (batch, index) => {
        const batchNum = i + index + 1;
        console.log(`⚡ 处理第 ${batchNum} 批，地址数量: ${batch.length}`);

        try {
          const [subscribedAddresses, userWalletAddresses] = await Promise.all([
            this.addressService.getSubscribedAddresses(batch),
            this.getUserWalletAddresses(batch),
          ]);

          return { subscribedAddresses, userWalletAddresses, batchNum };
        } catch (error) {
          console.error(`❌ 第 ${batchNum} 批处理失败:`, error);
          return { subscribedAddresses: [], userWalletAddresses: new Set(), batchNum };
        }
      });

      const results = await Promise.all(batchPromises);

      // 合并结果
      results.forEach(result => {
        result.subscribedAddresses.forEach(addr => allTargetAddresses.add(addr));
        result.userWalletAddresses.forEach(addr => allTargetAddresses.add(addr));
        console.log(`✅ 第 ${result.batchNum} 批完成`);
      });
    }

    console.log(`⚡ 快速处理完成，找到 ${allTargetAddresses.size} 个目标地址`);

    // 过滤出目标事件
    const targetEvents = events.filter(event => allTargetAddresses.has(event.toAddress));
    return targetEvents;
  }

  /**
   * 获取用户钱包地址集合
   */
  private async getUserWalletAddresses(addresses: string[]): Promise<Set<string>> {
    try {
      const activeWalletAddresses = await this.walletService.getAllActiveWalletAddresses();
      const addressSet = new Set(activeWalletAddresses);

      // 只返回在检查列表中的地址
      return new Set(addresses.filter(addr => addressSet.has(addr)));
    } catch (error) {
      console.error('获取用户钱包地址失败:', error);
      return new Set();
    }
  }

  /**
   * 更新用户钱包余额
   */
  private async updateUserWalletBalances(events: TransferEvent[]): Promise<void> {
    try {
      for (const event of events) {
        const wallet = await this.walletService.getUserWalletByAddress(event.toAddress);

        if (wallet) {
          // 检查是否已经处理过这个交易（防重复）
          const existingTransfer = await this.transferService.getTransferByHash(event.transactionHash);
          if (existingTransfer && existingTransfer.walletBalanceUpdated) {
            console.log(`交易 ${event.transactionHash} 的钱包余额已更新，跳过`);
            continue;
          }

          // 计算新余额
          const currentBalance = BigInt(wallet.balance || '0');
          const receivedAmount = BigInt(event.amount);
          const newBalance = currentBalance + receivedAmount;

          // 更新钱包余额
          const updateSuccess = await this.walletService.updateWalletBalance(
            event.toAddress,
            newBalance.toString(),
            event.amount
          );

          // 标记该交易的钱包余额已更新
          if (updateSuccess && existingTransfer) {
            await this.transferService.markWalletBalanceUpdated(existingTransfer._id.toString());
          }

          console.log(`更新用户 ${wallet.userId} 钱包余额: +${this.blockchainService.formatUSDTAmount(event.amount)} USDT`);
        }
      }
    } catch (error) {
      console.error('更新用户钱包余额失败:', error);
    }
  }

  /**
   * 开始确认处理循环
   */
  private startConfirmationLoop(): void {
    const processConfirmations = async () => {
      if (!this.isScanning) return;

      try {
        const latestBlock = await this.blockchainService.getLatestBlockNumber();
        await this.transferService.updateConfirmationStatus(
          latestBlock,
          config.scanner.confirmationBlocks
        );
      } catch (error) {
        console.error('处理确认失败:', error);
      }
    };

    // 每30秒处理一次确认
    this.confirmationInterval = setInterval(processConfirmations, 30000);
  }

  /**
   * 开始Webhook处理循环
   */
  private startWebhookLoop(): void {
    const processWebhooks = async () => {
      if (!this.isScanning) return;

      try {
        // 获取需要发送Webhook的Transfer
        const transfers = await this.transferService.getTransfersForWebhook(50);

        if (transfers.length > 0) {
          console.log(`开始发送 ${transfers.length} 个Webhook通知`);

          const successfulIds: string[] = [];

          for (const transfer of transfers) {
            let success = false;

            // 检查是否是用户钱包地址，如果是则发送新的充值回调
            const userWallet = await this.walletService.getUserWalletByAddress(transfer.toAddress);

            if (userWallet) {
              // 发送新的充值回调
              success = await this.webhookService.sendDepositCallback(transfer, userWallet.userId);
            } else {
              // 发送传统的转账通知（兼容性）
              // success = await this.webhookService.sendTransferNotification(transfer);
            }

            if (success) {
              successfulIds.push(transfer._id.toString());
            }

            // 避免频繁请求
            await new Promise(resolve => setTimeout(resolve, 200));
          }

          // 标记成功发送的Webhook
          if (successfulIds.length > 0) {
            await this.transferService.markWebhookSent(successfulIds);
            console.log(`成功发送 ${successfulIds.length} 个Webhook通知`);
          }
        }
      } catch (error) {
        console.error('处理Webhook失败:', error);
      }
    };

    // 每10秒处理一次Webhook
    this.webhookInterval = setInterval(processWebhooks, 10000);
  }

  /**
   * 漏块重扫机制
   */
  public async rescanMissingBlocks(fromBlock: number, toBlock: number): Promise<void> {
    try {
      console.log(`开始重扫漏块: ${fromBlock} - ${toBlock}`);

      // 检查这个范围内是否有已存在的Transfer记录
      const existingTransfers = await this.transferService.getTransfersByBlockRange(fromBlock, toBlock);
      const existingBlocks = new Set(existingTransfers.map(t => t.blockNumber));

      // 分批扫描以避免RPC限制
      const batchSize = 50;
      for (let start = fromBlock; start <= toBlock; start += batchSize) {
        const end = Math.min(start + batchSize - 1, toBlock);

        // 跳过已有数据的区块
        const blocksToScan = [];
        for (let block = start; block <= end; block++) {
          if (!existingBlocks.has(block)) {
            blocksToScan.push(block);
          }
        }

        if (blocksToScan.length === 0) continue;

        console.log(`重扫区块批次: ${blocksToScan[0]} - ${blocksToScan[blocksToScan.length - 1]}`);

        const events = await this.blockchainService.scanTransferEvents(
          blocksToScan[0],
          blocksToScan[blocksToScan.length - 1]
        );

        const targetEvents = await this.filterTargetEvents(events);

        if (targetEvents.length > 0) {
          await this.transferService.batchSaveTransferEvents(
            targetEvents,
            (amount) => this.blockchainService.formatUSDTAmount(amount)
          );
        }

        // 添加延迟避免RPC限流
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`漏块重扫完成: ${fromBlock} - ${toBlock}`);
    } catch (error) {
      console.error('漏块重扫失败:', error);
      throw error;
    }
  }

  /**
   * 获取扫描服务状态
   */
  public async getStatus(): Promise<{
    isScanning: boolean;
    lastScannedBlock: number;
    latestBlock: number;
    blocksBehind: number;
    lastScanTime: Date;
    networkConnected: boolean;
    addressCount: number;
    transferStats: any;
  }> {
    try {
      const [scanState, latestBlock, networkConnected, addressStats, transferStats] = await Promise.all([
        ScanState.findOne(),
        this.blockchainService.getLatestBlockNumber().catch(() => 0),
        this.blockchainService.checkConnection(),
        this.addressService.getStatistics(),
        this.transferService.getStatistics(),
      ]);

      const lastScannedBlock = scanState?.lastScannedBlock || 0;
      const blocksBehind = Math.max(0, latestBlock - lastScannedBlock);

      return {
        isScanning: this.isScanning,
        lastScannedBlock,
        latestBlock,
        blocksBehind,
        lastScanTime: scanState?.lastScanTime || new Date(),
        networkConnected,
        addressCount: addressStats.totalAddresses,
        transferStats,
      };
    } catch (error) {
      console.error('获取扫描状态失败:', error);
      return {
        isScanning: false,
        lastScannedBlock: 0,
        latestBlock: 0,
        blocksBehind: 0,
        lastScanTime: new Date(),
        networkConnected: false,
        addressCount: 0,
        transferStats: {},
      };
    }
  }

  /**
   * 手动触发一次扫描
   */
  public async manualScan(): Promise<{
    scannedBlocks: number;
    foundEvents: number;
    targetEvents: number;
  }> {
    try {
      console.log('开始手动扫描...');

      const scanState = await ScanState.findOne();
      if (!scanState) {
        throw new Error('找不到扫描状态');
      }

      const latestBlock = await this.blockchainService.getLatestBlockNumber();
      const fromBlock = scanState.lastScannedBlock + 1;
      const toBlock = Math.min(latestBlock, fromBlock + 10); // 手动扫描最多10个区块

      if (fromBlock > toBlock) {
        return { scannedBlocks: 0, foundEvents: 0, targetEvents: 0 };
      }

      const events = await this.blockchainService.scanTransferEvents(fromBlock, toBlock);
      const targetEvents = await this.filterTargetEvents(events);

      if (targetEvents.length > 0) {
        await this.transferService.batchSaveTransferEvents(
          targetEvents,
          (amount) => this.blockchainService.formatUSDTAmount(amount)
        );
      }

      await this.updateScanState(this.isScanning, toBlock);

      console.log(`手动扫描完成: 区块 ${fromBlock}-${toBlock}, 事件 ${events.length}, 目标事件 ${targetEvents.length}`);

      return {
        scannedBlocks: toBlock - fromBlock + 1,
        foundEvents: events.length,
        targetEvents: targetEvents.length,
      };
    } catch (error) {
      console.error('手动扫描失败:', error);
      throw error;
    }
  }
}
