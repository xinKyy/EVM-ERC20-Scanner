import Web3 from 'web3';
import crypto from 'crypto';
import { UserWallet, IUserWallet } from '../models';
import { config } from '../config';

export class WalletService {
  private web3: Web3;
  private encryptionKey: string;

  constructor() {
    this.web3 = new Web3(config.bsc.rpcUrl);
    // 使用环境变量或生成固定的加密密钥
    this.encryptionKey = process.env.WALLET_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
  }

  /**
   * 为用户生成或获取钱包地址
   * @param userId 用户ID
   * @returns 钱包地址和是否为新创建
   */
  public async getOrCreateUserWallet(userId: string): Promise<{
    address: string;
    isNew: boolean;
  }> {
    try {
      // 检查用户是否已有钱包
      const existingWallet = await UserWallet.findOne({ userId });

      if (existingWallet) {
        console.log(`用户 ${userId} 已有钱包地址: ${existingWallet.address}`);
        return {
          address: existingWallet.address,
          isNew: false,
        };
      }

      // 生成新的钱包
      const account = this.web3.eth.accounts.create();
      const encryptedPrivateKey = this.encryptPrivateKey(account.privateKey);

      // 保存到数据库
      const userWallet = new UserWallet({
        userId,
        address: account.address.toLowerCase(),
        encryptedPrivateKey,
        balance: '0',
        balanceFormatted: '0.000000',
        totalReceived: '0',
        totalReceivedFormatted: '0.000000',
        isActive: true,
      });

      await userWallet.save();

      console.log(`为用户 ${userId} 创建新钱包地址: ${account.address}`);

      return {
        address: account.address.toLowerCase(),
        isNew: true,
      };
    } catch (error) {
      console.error('创建或获取用户钱包失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户钱包信息
   * @param userId 用户ID
   * @returns 钱包信息
   */
  public async getUserWallet(userId: string): Promise<IUserWallet | null> {
    try {
      return await UserWallet.findOne({ userId, isActive: true });
    } catch (error) {
      console.error('获取用户钱包失败:', error);
      return null;
    }
  }

  /**
   * 根据地址获取用户钱包
   * @param address 钱包地址
   * @returns 钱包信息
   */
  public async getUserWalletByAddress(address: string): Promise<IUserWallet | null> {
    try {
      return await UserWallet.findOne({
        address: address.toLowerCase(),
        isActive: true
      });
    } catch (error) {
      console.error('根据地址获取用户钱包失败:', error);
      return null;
    }
  }

  /**
   * 更新用户钱包余额
   * @param address 钱包地址
   * @param newBalance 新余额 (wei)
   * @param receivedAmount 本次收到的金额 (wei)
   * @returns 是否更新成功
   */
  public async updateWalletBalance(
    address: string,
    newBalance: string,
    receivedAmount?: string
  ): Promise<boolean> {
    try {
      const wallet = await UserWallet.findOne({
        address: address.toLowerCase()
      });

      if (!wallet) {
        console.warn(`未找到地址 ${address} 对应的钱包`);
        return false;
      }

      // 更新余额
      wallet.balance = newBalance;
      wallet.balanceFormatted = this.formatUSDTAmount(newBalance);

      // 如果有新收到的金额，更新累计收到金额
      if (receivedAmount) {
        const currentTotal = BigInt(wallet.totalReceived || '0');
        const newTotal = currentTotal + BigInt(receivedAmount);
        wallet.totalReceived = newTotal.toString();
        wallet.totalReceivedFormatted = this.formatUSDTAmount(newTotal.toString());
      }

      await wallet.save();

      console.log(`更新钱包 ${address} 余额: ${wallet.balanceFormatted} USDT`);
      return true;
    } catch (error) {
      console.error('更新钱包余额失败:', error);
      return false;
    }
  }

  /**
   * 获取需要归集的钱包列表
   * @param threshold 归集阈值 (wei)
   * @returns 需要归集的钱包列表
   */
  public async getWalletsForCollection(threshold: string): Promise<IUserWallet[]> {
    try {
      // 获取所有活跃钱包
      const allWallets = await UserWallet.find({
        isActive: true,
      });

      // 在应用层进行数值比较（避免MongoDB字符串比较的问题）
      const thresholdBigInt = BigInt(threshold);
      const walletsToCollect = allWallets.filter(wallet => {
        try {
          const balanceBigInt = BigInt(wallet.balance || '0');
          return balanceBigInt >= thresholdBigInt;
        } catch (error) {
          console.error(`解析钱包余额失败 ${wallet.address}:`, error);
          return false;
        }
      });

      // 按余额降序排列
      walletsToCollect.sort((a, b) => {
        try {
          const balanceA = BigInt(a.balance || '0');
          const balanceB = BigInt(b.balance || '0');
          if (balanceA > balanceB) return -1;
          if (balanceA < balanceB) return 1;
          return 0;
        } catch (error) {
          return 0;
        }
      });

      console.log(walletsToCollect, "需要归集的钱包")
      console.log(threshold, "归集threshold")
      return walletsToCollect;
    } catch (error) {
      console.error('获取需要归集的钱包失败:', error);
      return [];
    }
  }

  /**
   * 获取用户私钥（解密）
   * @param userId 用户ID
   * @returns 私钥
   */
  public async getUserPrivateKey(userId: string): Promise<string | null> {
    try {
      const wallet = await UserWallet.findOne({ userId, isActive: true });

      if (!wallet) {
        return null;
      }

      return this.decryptPrivateKey(wallet.encryptedPrivateKey);
    } catch (error) {
      console.error('获取用户私钥失败:', error);
      return null;
    }
  }

  /**
   * 根据地址获取私钥（解密）
   * @param address 钱包地址
   * @returns 私钥
   */
  public async getPrivateKeyByAddress(address: string): Promise<string | null> {
    try {
      const wallet = await UserWallet.findOne({
        address: address.toLowerCase(),
        isActive: true
      });

      if (!wallet) {
        return null;
      }

      return this.decryptPrivateKey(wallet.encryptedPrivateKey);
    } catch (error) {
      console.error('根据地址获取私钥失败:', error);
      return null;
    }
  }

  /**
   * 获取所有活跃的用户钱包地址
   * @returns 地址列表
   */
  public async getAllActiveWalletAddresses(): Promise<string[]> {
    try {
      const wallets = await UserWallet.find({
        isActive: true
      }).select('address');

      return wallets.map(wallet => wallet.address);
    } catch (error) {
      console.error('获取所有活跃钱包地址失败:', error);
      return [];
    }
  }

  /**
   * 禁用用户钱包
   * @param userId 用户ID
   * @returns 是否成功
   */
  public async disableUserWallet(userId: string): Promise<boolean> {
    try {
      const result = await UserWallet.updateOne(
        { userId },
        { isActive: false }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('禁用用户钱包失败:', error);
      return false;
    }
  }

  /**
   * 获取钱包统计信息
   * @returns 统计信息
   */
  public async getWalletStatistics(): Promise<{
    totalWallets: number;
    activeWallets: number;
    totalBalance: string;
    totalBalanceFormatted: string;
    walletsNeedingCollection: number;
  }> {
    try {
      const [
        totalWallets,
        activeWallets,
        allActiveWallets,
        balanceAggregation,
      ] = await Promise.all([
        UserWallet.countDocuments(),
        UserWallet.countDocuments({ isActive: true }),
        UserWallet.find({ isActive: true }).select('balance'),
        UserWallet.aggregate([
          { $match: { isActive: true } },
          { 
            $group: { 
              _id: null, 
              totalBalance: { 
                $sum: { $toLong: '$balance' } 
              } 
            } 
          }
        ]),
      ]);

      // 在应用层计算需要归集的钱包数量（避免字符串比较问题）
      const thresholdBigInt = BigInt(config.collection.threshold);
      const walletsNeedingCollection = allActiveWallets.filter(wallet => {
        try {
          const balanceBigInt = BigInt(wallet.balance || '0');
          return balanceBigInt >= thresholdBigInt;
        } catch (error) {
          return false;
        }
      }).length;

      const totalBalance = balanceAggregation[0]?.totalBalance?.toString() || '0';

      return {
        totalWallets,
        activeWallets,
        totalBalance,
        totalBalanceFormatted: this.formatUSDTAmount(totalBalance),
        walletsNeedingCollection,
      };
    } catch (error) {
      console.error('获取钱包统计信息失败:', error);
      return {
        totalWallets: 0,
        activeWallets: 0,
        totalBalance: '0',
        totalBalanceFormatted: '0.000000',
        walletsNeedingCollection: 0,
      };
    }
  }

  /**
   * 加密私钥
   * @param privateKey 私钥
   * @returns 加密后的私钥
   */
  private encryptPrivateKey(privateKey: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * 解密私钥
   * @param encryptedPrivateKey 加密的私钥
   * @returns 解密后的私钥
   */
  private decryptPrivateKey(encryptedPrivateKey: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encryptedPrivateKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
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
      console.error('格式化USDT数量失败:', error);
      return '0.000000';
    }
  }

  /**
   * 验证地址格式
   * @param address 地址
   * @returns 是否有效
   */
  public isValidAddress(address: string): boolean {
    return this.web3.utils.isAddress(address);
  }
}
