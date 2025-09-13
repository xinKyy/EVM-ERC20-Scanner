import Web3 from 'web3';
import { WithdrawalRecord, IWithdrawalRecord, WithdrawalStatus } from '../models';
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

// ERC20 BalanceOf函数的ABI
const ERC20_BALANCE_ABI = {
  inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
  name: 'balanceOf',
  outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function'
};

export class WithdrawalService {
  private web3: Web3;
  private usdtContract: any;
  private isProcessing: boolean = false;

  constructor() {
    this.web3 = new Web3(config.bsc.rpcUrl);

    // 创建USDT合约实例
    this.usdtContract = new this.web3.eth.Contract(
      [ERC20_TRANSFER_ABI, ERC20_BALANCE_ABI],
      config.usdt.contractAddress
    );
  }

  /**
   * 创建提现请求
   * @param toAddress 提现目标地址
   * @param amount 提现金额 (wei)
   * @param requestedBy 请求者标识
   * @param userId 用户ID (可选)
   * @returns 提现记录
   */
  public async createWithdrawal(
    toAddress: string,
    amount: string,
    requestedBy: string,
    userId?: string
  ): Promise<{
    success: boolean;
    message: string;
    withdrawalRecord?: IWithdrawalRecord;
  }> {
    try {
      // 验证地址格式
      if (!this.web3.utils.isAddress(toAddress)) {
        return {
          success: false,
          message: '无效的提现地址格式',
        };
      }

      // 验证金额
      const amountBigInt = BigInt(amount);
      if (amountBigInt <= 0) {
        return {
          success: false,
          message: '提现金额必须大于0',
        };
      }

      // 检查提现钱包余额
      const withdrawalWalletBalance = await this.getWithdrawalWalletBalance();
      if (BigInt(withdrawalWalletBalance) < amountBigInt) {
        return {
          success: false,
          message: `提现钱包余额不足，当前余额: ${this.formatUSDTAmount(withdrawalWalletBalance)} USDT`,
        };
      }

      // 创建提现记录
      const withdrawalRecord = new WithdrawalRecord({
        userId,
        toAddress: toAddress.toLowerCase(),
        amount,
        amountFormatted: this.formatUSDTAmount(amount),
        withdrawalWalletAddress: config.wallets.withdrawal.address.toLowerCase(),
        status: WithdrawalStatus.PENDING,
        requestedBy,
        retryCount: 0,
      });

      await withdrawalRecord.save();

      console.log(`创建提现请求: ${withdrawalRecord.amountFormatted} USDT 到 ${toAddress}`);

      // 立即处理提现
      await this.processWithdrawal(withdrawalRecord);

      return {
        success: true,
        message: '提现请求创建成功',
        withdrawalRecord,
      };
    } catch (error) {
      console.error('创建提现请求失败:', error);
      return {
        success: false,
        message: `创建提现请求失败: ${error.message}`,
      };
    }
  }

  /**
   * 处理提现请求
   * @param withdrawalRecord 提现记录
   */
  private async processWithdrawal(withdrawalRecord: IWithdrawalRecord): Promise<void> {
    try {
      console.log(`开始处理提现: ${withdrawalRecord.amountFormatted} USDT 到 ${withdrawalRecord.toAddress}`);

      // 更新状态为处理中
      withdrawalRecord.status = WithdrawalStatus.PROCESSING;
      await withdrawalRecord.save();

      // 验证提现钱包配置
      if (!config.wallets.withdrawal.privateKey) {
        throw new Error('未配置提现钱包私钥');
      }

      // 执行USDT转账
      const txHash = await this.transferUSDT(
        config.wallets.withdrawal.privateKey,
        config.wallets.withdrawal.address,
        withdrawalRecord.toAddress,
        withdrawalRecord.amount
      );

      // 更新提现记录
      withdrawalRecord.transactionHash = txHash;
      withdrawalRecord.status = WithdrawalStatus.COMPLETED;
      await withdrawalRecord.save();

      console.log(`提现成功: ${withdrawalRecord.amountFormatted} USDT, 交易哈希: ${txHash}`);

    } catch (error) {
      console.error('处理提现失败:', error);

      // 更新失败状态
      withdrawalRecord.status = WithdrawalStatus.FAILED;
      withdrawalRecord.errorMessage = error.message;
      withdrawalRecord.retryCount += 1;
      await withdrawalRecord.save();

      throw error;
    }
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
   * 获取提现钱包余额
   * @returns USDT余额 (wei)
   */
  public async getWithdrawalWalletBalance(): Promise<string> {
    try {
      const balance = await this.usdtContract.methods
        .balanceOf(config.wallets.withdrawal.address)
        .call();

      return balance.toString();
    } catch (error) {
      console.error('获取提现钱包余额失败:', error);
      return '0';
    }
  }

  /**
   * 获取提现钱包信息
   * @returns 钱包信息
   */
  public async getWithdrawalWalletInfo(): Promise<{
    address: string;
    usdtBalance: string;
    usdtBalanceFormatted: string;
    bnbBalance: string;
    bnbBalanceFormatted: string;
  }> {
    try {
      const [usdtBalance, bnbBalance] = await Promise.all([
        this.getWithdrawalWalletBalance(),
        this.web3.eth.getBalance(config.wallets.withdrawal.address),
      ]);

      return {
        address: config.wallets.withdrawal.address,
        usdtBalance,
        usdtBalanceFormatted: this.formatUSDTAmount(usdtBalance),
        bnbBalance: bnbBalance.toString(),
        bnbBalanceFormatted: this.web3.utils.fromWei(bnbBalance, 'ether'),
      };
    } catch (error) {
      console.error('获取提现钱包信息失败:', error);
      return {
        address: config.wallets.withdrawal.address,
        usdtBalance: '0',
        usdtBalanceFormatted: '0.000000',
        bnbBalance: '0',
        bnbBalanceFormatted: '0',
      };
    }
  }

  /**
   * 重试失败的提现
   * @param withdrawalId 提现记录ID
   * @returns 重试结果
   */
  public async retryWithdrawal(withdrawalId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const withdrawalRecord = await WithdrawalRecord.findById(withdrawalId);

      if (!withdrawalRecord) {
        return {
          success: false,
          message: '提现记录不存在',
        };
      }

      if (withdrawalRecord.status !== WithdrawalStatus.FAILED) {
        return {
          success: false,
          message: '只能重试失败的提现记录',
        };
      }

      if (withdrawalRecord.retryCount >= 3) {
        return {
          success: false,
          message: '重试次数已达上限',
        };
      }

      // 重新处理提现
      await this.processWithdrawal(withdrawalRecord);

      return {
        success: true,
        message: '重试提现成功',
      };
    } catch (error) {
      console.error('重试提现失败:', error);
      return {
        success: false,
        message: `重试提现失败: ${error.message}`,
      };
    }
  }

  /**
   * 获取提现记录列表
   * @param filters 过滤条件
   * @param limit 限制数量
   * @param offset 偏移量
   * @returns 提现记录列表
   */
  public async getWithdrawalRecords(
    filters: {
      userId?: string;
      toAddress?: string;
      status?: WithdrawalStatus;
    } = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    records: IWithdrawalRecord[];
    total: number;
  }> {
    try {
      const query: any = {};

      if (filters.userId) {
        query.userId = filters.userId;
      }

      if (filters.toAddress) {
        query.toAddress = filters.toAddress.toLowerCase();
      }

      if (filters.status) {
        query.status = filters.status;
      }

      const [records, total] = await Promise.all([
        WithdrawalRecord.find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(offset),
        WithdrawalRecord.countDocuments(query),
      ]);

      return { records, total };
    } catch (error) {
      console.error('获取提现记录失败:', error);
      return { records: [], total: 0 };
    }
  }

  /**
   * 获取提现统计信息
   * @returns 统计信息
   */
  public async getWithdrawalStatistics(): Promise<{
    totalWithdrawals: number;
    completedWithdrawals: number;
    failedWithdrawals: number;
    pendingWithdrawals: number;
    totalAmountWithdrawn: string;
    totalAmountWithdrawnFormatted: string;
    todayWithdrawals: number;
    todayAmountWithdrawn: string;
    todayAmountWithdrawnFormatted: string;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        totalWithdrawals,
        completedWithdrawals,
        failedWithdrawals,
        pendingWithdrawals,
        totalAmountAggregation,
        todayWithdrawals,
        todayAmountAggregation,
      ] = await Promise.all([
        WithdrawalRecord.countDocuments(),
        WithdrawalRecord.countDocuments({ status: WithdrawalStatus.COMPLETED }),
        WithdrawalRecord.countDocuments({ status: WithdrawalStatus.FAILED }),
        WithdrawalRecord.countDocuments({ status: WithdrawalStatus.PENDING }),
        WithdrawalRecord.aggregate([
          { $match: { status: WithdrawalStatus.COMPLETED } },
          {
            $group: {
              _id: null,
              totalAmount: {
                $sum: { $toLong: '$amount' }
              }
            }
          }
        ]),
        WithdrawalRecord.countDocuments({
          createdAt: { $gte: today },
          status: WithdrawalStatus.COMPLETED
        }),
        WithdrawalRecord.aggregate([
          {
            $match: {
              createdAt: { $gte: today },
              status: WithdrawalStatus.COMPLETED
            }
          },
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

      const totalAmount = totalAmountAggregation[0]?.totalAmount?.toString() || '0';
      const todayAmount = todayAmountAggregation[0]?.totalAmount?.toString() || '0';

      return {
        totalWithdrawals,
        completedWithdrawals,
        failedWithdrawals,
        pendingWithdrawals,
        totalAmountWithdrawn: totalAmount,
        totalAmountWithdrawnFormatted: this.formatUSDTAmount(totalAmount),
        todayWithdrawals,
        todayAmountWithdrawn: todayAmount,
        todayAmountWithdrawnFormatted: this.formatUSDTAmount(todayAmount),
      };
    } catch (error) {
      console.error('获取提现统计信息失败:', error);
      return {
        totalWithdrawals: 0,
        completedWithdrawals: 0,
        failedWithdrawals: 0,
        pendingWithdrawals: 0,
        totalAmountWithdrawn: '0',
        totalAmountWithdrawnFormatted: '0.000000',
        todayWithdrawals: 0,
        todayAmountWithdrawn: '0',
        todayAmountWithdrawnFormatted: '0.000000',
      };
    }
  }

  /**
   * 启动提现处理服务
   */
  public async startWithdrawalProcessor(): Promise<void> {
    console.log('启动提现处理服务...');

    // 每10秒检查一次待处理的提现
    setInterval(async () => {
      if (!this.isProcessing) {
        await this.processPendingWithdrawals();
      }
    }, 10000);

    console.log('提现处理服务已启动');
  }

  /**
   * 处理待处理的提现
   */
  private async processPendingWithdrawals(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const pendingWithdrawals = await WithdrawalRecord.find({
        status: WithdrawalStatus.PENDING,
      }).limit(10);

      for (const withdrawal of pendingWithdrawals) {
        try {
          await this.processWithdrawal(withdrawal);

          // 添加延迟避免nonce冲突
          await this.sleep(2000);
        } catch (error) {
          console.error(`处理提现 ${withdrawal._id} 失败:`, error);
        }
      }
    } catch (error) {
      console.error('处理待处理提现失败:', error);
    } finally {
      this.isProcessing = false;
    }
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
