import { Request, Response } from 'express';
import { WithdrawalService } from '../services/WithdrawalService';
import Web3 from 'web3';

export class WithdrawalController {
  private withdrawalService: WithdrawalService;
  private web3: Web3;

  constructor() {
    this.withdrawalService = new WithdrawalService();
    this.web3 = new Web3();
  }

  /**
   * 创建提现请求
   */
  public createWithdrawal = async (req: Request, res: Response): Promise<void> => {
    try {
      const { toAddress, amount, userId } = req.body;
      const requestedBy = req.ip || 'unknown';

      // 验证参数
      if (!toAddress || !amount) {
        res.status(400).json({
          success: false,
          message: '请提供提现地址和金额',
          data: null,
        });
        return;
      }

      // 验证地址格式
      if (!this.web3.utils.isAddress(toAddress)) {
        res.status(400).json({
          success: false,
          message: '无效的提现地址格式',
          data: null,
        });
        return;
      }

      // 验证金额格式
      let amountWei: string;
      try {
        // 如果传入的是USDT数量，转换为wei
        if (typeof amount === 'string' && amount.includes('.')) {
          amountWei = this.web3.utils.toWei(amount, 'ether');
        } else {
          amountWei = amount.toString();
        }
        
        const amountBigInt = BigInt(amountWei);
        if (amountBigInt <= 0) {
          throw new Error('金额必须大于0');
        }
      } catch (error) {
        res.status(400).json({
          success: false,
          message: '无效的金额格式',
          data: null,
        });
        return;
      }

      // 创建提现请求
      const result = await this.withdrawalService.createWithdrawal(
        toAddress,
        amountWei,
        requestedBy,
        userId
      );

      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          data: {
            withdrawalId: result.withdrawalRecord?._id,
            toAddress,
            amount: result.withdrawalRecord?.amountFormatted,
            status: result.withdrawalRecord?.status,
            transactionHash: result.withdrawalRecord?.transactionHash,
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
      console.error('创建提现请求失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 获取提现记录列表
   */
  public getWithdrawalRecords = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, toAddress, status } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 1000);
      const offset = (page - 1) * limit;

      const filters: any = {};
      if (userId) filters.userId = userId as string;
      if (toAddress) filters.toAddress = toAddress as string;
      if (status) filters.status = status as string;

      const result = await this.withdrawalService.getWithdrawalRecords(
        filters,
        limit,
        offset
      );

      res.status(200).json({
        success: true,
        message: '获取提现记录成功',
        data: {
          records: result.records,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
          },
        },
      });
    } catch (error: any) {
      console.error('获取提现记录失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 获取提现统计信息
   */
  public getWithdrawalStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.withdrawalService.getWithdrawalStatistics();

      res.status(200).json({
        success: true,
        message: '获取提现统计信息成功',
        data: stats,
      });
    } catch (error: any) {
      console.error('获取提现统计信息失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 获取提现钱包信息
   */
  public getWithdrawalWalletInfo = async (req: Request, res: Response): Promise<void> => {
    try {
      const walletInfo = await this.withdrawalService.getWithdrawalWalletInfo();

      res.status(200).json({
        success: true,
        message: '获取提现钱包信息成功',
        data: walletInfo,
      });
    } catch (error: any) {
      console.error('获取提现钱包信息失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 重试失败的提现
   */
  public retryWithdrawal = async (req: Request, res: Response): Promise<void> => {
    try {
      const { withdrawalId } = req.params;

      if (!withdrawalId) {
        res.status(400).json({
          success: false,
          message: '请提供提现记录ID',
          data: null,
        });
        return;
      }

      const result = await this.withdrawalService.retryWithdrawal(withdrawalId);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          data: null,
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
          data: null,
        });
      }
    } catch (error: any) {
      console.error('重试提现失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };
}
