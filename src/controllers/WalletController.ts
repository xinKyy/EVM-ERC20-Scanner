import { Request, Response } from 'express';
import { WalletService } from '../services/WalletService';
import { CollectionService } from '../services/CollectionService';

export class WalletController {
  private walletService: WalletService;
  private collectionService: CollectionService;

  constructor() {
    this.walletService = new WalletService();
    this.collectionService = new CollectionService();
  }

  /**
   * 为用户生成或获取钱包地址
   */
  public createOrGetWallet = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.body;

      // 验证参数
      if (!userId || typeof userId !== 'string') {
        res.status(400).json({
          success: false,
          message: '请提供有效的用户ID',
          data: null,
        });
        return;
      }

      if (userId.length < 1 || userId.length > 100) {
        res.status(400).json({
          success: false,
          message: '用户ID长度必须在1-100字符之间',
          data: null,
        });
        return;
      }

      // 生成或获取钱包
      const result = await this.walletService.getOrCreateUserWallet(userId);

      res.status(200).json({
        success: true,
        message: result.isNew ? '钱包创建成功' : '获取钱包成功',
        data: {
          userId,
          address: result.address,
          isNew: result.isNew,
        },
      });
    } catch (error: any) {
      console.error('创建或获取钱包失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 获取用户钱包信息
   */
  public getUserWallet = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: '请提供用户ID',
          data: null,
        });
        return;
      }

      const wallet = await this.walletService.getUserWallet(userId);

      if (!wallet) {
        res.status(404).json({
          success: false,
          message: '用户钱包不存在',
          data: null,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: '获取用户钱包成功',
        data: {
          userId: wallet.userId,
          address: wallet.address,
          balance: wallet.balanceFormatted,
          totalReceived: wallet.totalReceivedFormatted,
          lastCollectionAt: wallet.lastCollectionAt,
          isActive: wallet.isActive,
          createdAt: wallet.createdAt,
        },
      });
    } catch (error: any) {
      console.error('获取用户钱包失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 手动触发用户钱包归集
   */
  public collectUserWallet = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: '请提供用户ID',
          data: null,
        });
        return;
      }

      const result = await this.collectionService.manualCollect(userId);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          data: {
            collectionRecord: result.collectionRecord,
          },
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
          data: null,
        });
      }
    } catch (error: any) {
      console.error('手动归集失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 获取钱包统计信息
   */
  public getWalletStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.walletService.getWalletStatistics();

      res.status(200).json({
        success: true,
        message: '获取钱包统计信息成功',
        data: stats,
      });
    } catch (error: any) {
      console.error('获取钱包统计信息失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 获取归集统计信息
   */
  public getCollectionStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.collectionService.getCollectionStatistics();

      res.status(200).json({
        success: true,
        message: '获取归集统计信息成功',
        data: stats,
      });
    } catch (error: any) {
      console.error('获取归集统计信息失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 禁用用户钱包
   */
  public disableUserWallet = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: '请提供用户ID',
          data: null,
        });
        return;
      }

      const success = await this.walletService.disableUserWallet(userId);

      if (success) {
        res.status(200).json({
          success: true,
          message: '用户钱包已禁用',
          data: null,
        });
      } else {
        res.status(404).json({
          success: false,
          message: '用户钱包不存在或已禁用',
          data: null,
        });
      }
    } catch (error: any) {
      console.error('禁用用户钱包失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };
}
