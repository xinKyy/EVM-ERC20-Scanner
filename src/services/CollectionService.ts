import Web3 from 'web3';
import { CollectionRecord, ICollectionRecord, CollectionStatus } from '../models';
import { WalletService } from './WalletService';
import { config } from '../config';

// ERC20 Transfer函数的ABI
const ERC20_TRANSFER_ABI = {
  inputs: [
    { internalType: 'address', name: 'to', type: 'address' },
    { internalType: 'uint256', name: 'amount', type: 'uint256' }
  ],
  name: 'transfer',
  outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
  stateMutability: 'nonpayable',
  type: 'function'
};

export class CollectionService {
  private web3: Web3;
  private walletService: WalletService;
  private usdtContract: any;
  private isProcessing: boolean = false;

  constructor() {
    this.web3 = new Web3(config.bsc.rpcUrl);
    this.walletService = new WalletService();

    // 创建USDT合约实例
    this.usdtContract = new this.web3.eth.Contract(
      [ERC20_TRANSFER_ABI],
      config.usdt.contractAddress
    );
  }

  /**
   * 启动自动归集服务
   */
  public async startAutoCollection(): Promise<void> {
    if (!config.collection.enabled) {
      console.log('资金归集功能已禁用');
      return;
    }

    console.log('启动自动资金归集服务...');

    // 验证配置
    if (!this.validateCollectionConfig()) {
      throw new Error('归集配置验证失败');
    }

    // 每30秒检查一次是否需要归集
    setInterval(async () => {
      if (!this.isProcessing) {
        await this.processCollections();
      }
    }, 30000);

    console.log('自动资金归集服务已启动');
  }

  /**
   * 处理资金归集
   */
  public async processCollections(): Promise<void> {
    if (this.isProcessing) {
      console.log('归集服务正在处理中，跳过本次检查');
      return;
    }

    this.isProcessing = true;

    try {
      console.log('开始检查需要归集的钱包...');

      // 获取需要归集的钱包
      const walletsToCollect = await this.walletService.getWalletsForCollection(
        config.collection.threshold
      );

      if (walletsToCollect.length === 0) {
        console.log('没有需要归集的钱包');
        return;
      }

      console.log(`发现 ${walletsToCollect.length} 个钱包需要归集`);

      // 逐个处理归集
      for (const wallet of walletsToCollect) {
        try {
          await this.collectWalletFunds(wallet.userId, wallet.address, wallet.balance);

          // 添加延迟避免nonce冲突
          await this.sleep(2000);
        } catch (error) {
          console.error(`归集钱包 ${wallet.address} 失败:`, error);
        }
      }

    } catch (error) {
      console.error('处理资金归集失败:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 归集指定钱包的资金
   * @param userId 用户ID
   * @param fromAddress 源地址
   * @param amount 归集金额 (wei)
   * @returns 归集记录
   */
  public async collectWalletFunds(
    userId: string,
    fromAddress: string,
    amount: string
  ): Promise<ICollectionRecord> {
    try {
      console.log(`开始归集用户 ${userId} 钱包 ${fromAddress} 的 ${this.formatUSDTAmount(amount)} USDT`);

      // 创建归集记录
      const collectionRecord = new CollectionRecord({
        userId,
        fromAddress: fromAddress.toLowerCase(),
        toAddress: config.wallets.collection.address.toLowerCase(),
        amount,
        amountFormatted: this.formatUSDTAmount(amount),
        gasFeeAddress: config.wallets.gasFee.address.toLowerCase(),
        status: CollectionStatus.PENDING,
        retryCount: 0,
      });

      await collectionRecord.save();

      // 执行归集交易
      await this.executeCollectionTransaction(collectionRecord);

      return collectionRecord;
    } catch (error) {
      console.error('归集钱包资金失败:', error);
      throw error;
    }
  }

  /**
   * 执行归集交易
   * @param collectionRecord 归集记录
   */
  private async executeCollectionTransaction(collectionRecord: ICollectionRecord): Promise<void> {
    try {
      // 更新状态为处理中
      collectionRecord.status = CollectionStatus.PROCESSING;
      await collectionRecord.save();

      // 获取用户钱包私钥
      const userPrivateKey = await this.walletService.getPrivateKeyByAddress(collectionRecord.fromAddress);
      if (!userPrivateKey) {
        throw new Error('无法获取用户钱包私钥');
      }

      // 获取gas费钱包私钥
      const gasFeePrivateKey = config.wallets.gasFee.privateKey;
      if (!gasFeePrivateKey) {
        throw new Error('未配置gas费钱包私钥');
      }

      // 1. 先从gas费钱包转BNB给用户钱包作为手续费
      const gasAmount = await this.estimateGasFee();
      await this.transferBNBForGas(
        gasFeePrivateKey,
        collectionRecord.fromAddress,
        gasAmount
      );

      // 等待BNB转账确认
      await this.sleep(3000);

      // 2. 执行USDT转账
      const txHash = await this.transferUSDT(
        userPrivateKey,
        collectionRecord.fromAddress,
        collectionRecord.toAddress,
        collectionRecord.amount
      );

      // 更新归集记录
      collectionRecord.transactionHash = txHash;
      collectionRecord.status = CollectionStatus.COMPLETED;
      collectionRecord.gasUsed = gasAmount;
      await collectionRecord.save();

      // 更新用户钱包余额为0
      await this.walletService.updateWalletBalance(collectionRecord.fromAddress, '0');

      console.log(`归集成功: ${collectionRecord.amountFormatted} USDT, 交易哈希: ${txHash}`);

    } catch (error) {
      console.error('执行归集交易失败:', error);

      // 更新失败状态
      collectionRecord.status = CollectionStatus.FAILED;
      collectionRecord.errorMessage = error.message;
      collectionRecord.retryCount += 1;
      await collectionRecord.save();

      throw error;
    }
  }

  /**
   * 转账BNB作为gas费
   * @param privateKey 私钥
   * @param toAddress 目标地址
   * @param amount gas费金额 (wei)
   * @returns 交易哈希
   */
  private async transferBNB(
    privateKey: string,
    toAddress: string,
    amount: string
  ): Promise<string> {
    try {
      const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
      const fromAddress = account.address;

      // 获取nonce
      const nonce = await this.web3.eth.getTransactionCount(fromAddress, 'pending');

      // 构建交易
      const tx = {
        from: fromAddress,
        to: toAddress,
        value: amount,
        gas: 21000,
        gasPrice: await this.web3.eth.getGasPrice(),
        nonce: nonce,
      };

      // 签名并发送交易
      const signedTx = await account.signTransaction(tx);
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction!);

      return receipt.transactionHash.toString();
    } catch (error) {
      console.error('转账BNB失败:', error);
      throw error;
    }
  }

  /**
   * 专门用于转账gas费的BNB转账
   * @param privateKey gas费钱包私钥
   * @param toAddress 目标地址
   * @param amount gas费金额
   * @returns 交易哈希
   */
  private async transferBNBForGas(
    privateKey: string,
    toAddress: string,
    amount: string
  ): Promise<string> {
    console.log(`转账 ${this.web3.utils.fromWei(amount, 'ether')} BNB 作为gas费到 ${toAddress}`);
    return await this.transferBNB(privateKey, toAddress, amount);
  }

  /**
   * 转账USDT
   * @param privateKey 私钥
   * @param fromAddress 源地址
   * @param toAddress 目标地址
   * @param amount USDT数量 (wei)
   * @returns 交易哈希
   */
  private async transferUSDT(
    privateKey: string,
    fromAddress: string,
    toAddress: string,
    amount: string
  ): Promise<string> {
    try {
      const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);

      // 获取nonce
      const nonce = await this.web3.eth.getTransactionCount(fromAddress, 'pending');

      // 编码transfer函数调用
      const transferData = this.usdtContract.methods.transfer(toAddress, amount).encodeABI();

      // 估算gas
      const gasEstimate = await this.web3.eth.estimateGas({
        from: fromAddress,
        to: config.usdt.contractAddress,
        data: transferData,
      });

      // 构建交易
      const tx = {
        from: fromAddress,
        to: config.usdt.contractAddress,
        data: transferData,
        gas: Math.floor(Number(gasEstimate) * 1.2), // 增加20%的gas缓冲
        gasPrice: await this.web3.eth.getGasPrice(),
        nonce: nonce,
      };

      // 签名并发送交易
      const signedTx = await account.signTransaction(tx);
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction!);

      return receipt.transactionHash.toString();
    } catch (error) {
      console.error('转账USDT失败:', error);
      throw error;
    }
  }

  /**
   * 估算gas费用
   * @returns gas费用 (wei)
   */
  private async estimateGasFee(): Promise<string> {
    try {
      const gasPrice = await this.web3.eth.getGasPrice();
      const gasLimit = BigInt(100000); // USDT转账大约需要的gas
      const gasFee = BigInt(gasPrice) * gasLimit;

      // 增加50%缓冲
      return (gasFee * BigInt(150) / BigInt(100)).toString();
    } catch (error) {
      console.error('估算gas费失败:', error);
      // 返回默认值 0.001 BNB
      return this.web3.utils.toWei('0.001', 'ether');
    }
  }

  /**
   * 手动触发归集
   * @param userId 用户ID
   * @returns 归集结果
   */
  public async manualCollect(userId: string): Promise<{
    success: boolean;
    message: string;
    collectionRecord?: ICollectionRecord;
  }> {
    try {
      const wallet = await this.walletService.getUserWallet(userId);

      if (!wallet) {
        return {
          success: false,
          message: '用户钱包不存在',
        };
      }

      const balance = BigInt(wallet.balance);
      const threshold = BigInt(config.collection.threshold);

      if (balance < threshold) {
        return {
          success: false,
          message: `余额不足，当前: ${wallet.balanceFormatted} USDT, 最低: ${this.formatUSDTAmount(config.collection.threshold)} USDT`,
        };
      }

      const collectionRecord = await this.collectWalletFunds(
        userId,
        wallet.address,
        wallet.balance
      );

      return {
        success: true,
        message: '归集成功',
        collectionRecord,
      };
    } catch (error) {
      console.error('手动归集失败:', error);
      return {
        success: false,
        message: `归集失败: ${error.message}`,
      };
    }
  }

  /**
   * 获取归集统计信息
   * @returns 统计信息
   */
  public async getCollectionStatistics(): Promise<{
    totalCollections: number;
    completedCollections: number;
    failedCollections: number;
    totalAmountCollected: string;
    totalAmountCollectedFormatted: string;
  }> {
    try {
      const [
        totalCollections,
        completedCollections,
        failedCollections,
        amountAggregation,
      ] = await Promise.all([
        CollectionRecord.countDocuments(),
        CollectionRecord.countDocuments({ status: CollectionStatus.COMPLETED }),
        CollectionRecord.countDocuments({ status: CollectionStatus.FAILED }),
        CollectionRecord.aggregate([
          { $match: { status: CollectionStatus.COMPLETED } },
          {
            $group: {
              _id: null,
              totalAmount: {
                $sum: { $toLong: '$amount' }
              }
            }
          }
        ]),
      ]);

      const totalAmount = amountAggregation[0]?.totalAmount?.toString() || '0';

      return {
        totalCollections,
        completedCollections,
        failedCollections,
        totalAmountCollected: totalAmount,
        totalAmountCollectedFormatted: this.formatUSDTAmount(totalAmount),
      };
    } catch (error) {
      console.error('获取归集统计信息失败:', error);
      return {
        totalCollections: 0,
        completedCollections: 0,
        failedCollections: 0,
        totalAmountCollected: '0',
        totalAmountCollectedFormatted: '0.000000',
      };
    }
  }

  /**
   * 验证归集配置
   * @returns 是否有效
   */
  private validateCollectionConfig(): boolean {
    const { collection, gasFee } = config.wallets;

    if (!collection.address || !collection.privateKey) {
      console.error('归集钱包配置不完整');
      return false;
    }

    if (!gasFee.address || !gasFee.privateKey) {
      console.error('gas费钱包配置不完整');
      return false;
    }

    if (!this.web3.utils.isAddress(collection.address)) {
      console.error('归集钱包地址格式无效');
      return false;
    }

    if (!this.web3.utils.isAddress(gasFee.address)) {
      console.error('gas费钱包地址格式无效');
      return false;
    }

    return true;
  }

  /**
   * 格式化USDT金额
   * @param weiAmount Wei数量
   * @returns 格式化的USDT数量
   */
  private formatUSDTAmount(weiAmount: string): string {
    try {
      const amount = this.web3.utils.fromWei(weiAmount, 'ether');
      return parseFloat(amount).toFixed(6);
    } catch (error) {
      return '0.000000';
    }
  }

  /**
   * 延迟函数
   * @param ms 毫秒
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
