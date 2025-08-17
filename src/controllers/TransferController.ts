import { Request, Response } from 'express';
import { TransferService } from '../services/TransferService';

export class TransferController {
  private transferService: TransferService;

  constructor() {
    this.transferService = new TransferService();
  }

  /**
   * 获取Transfer统计信息
   */
  public getStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.transferService.getStatistics();

      res.status(200).json({
        success: true,
        message: '获取Transfer统计信息成功',
        data: stats,
      });
    } catch (error: any) {
      console.error('获取Transfer统计信息失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 根据地址获取Transfer记录
   */
  public getTransfersByAddress = async (req: Request, res: Response): Promise<void> => {
    try {
      const { address } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 1000);
      const offset = (page - 1) * limit;

      // 验证地址格式
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        res.status(400).json({
          success: false,
          message: '无效的地址格式',
          data: null,
        });
        return;
      }

      const result = await this.transferService.getTransfersByAddress(address, limit, offset);

      res.status(200).json({
        success: true,
        message: '获取Transfer记录成功',
        data: {
          transfers: result.transfers,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
          },
        },
      });
    } catch (error: any) {
      console.error('获取Transfer记录失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 根据区块范围获取Transfer记录
   */
  public getTransfersByBlockRange = async (req: Request, res: Response): Promise<void> => {
    try {
      const fromBlock = parseInt(req.query.fromBlock as string);
      const toBlock = parseInt(req.query.toBlock as string);

      // 验证参数
      if (!fromBlock || !toBlock || isNaN(fromBlock) || isNaN(toBlock)) {
        res.status(400).json({
          success: false,
          message: '请提供有效的区块范围参数',
          data: null,
        });
        return;
      }

      if (fromBlock > toBlock) {
        res.status(400).json({
          success: false,
          message: '起始区块不能大于结束区块',
          data: null,
        });
        return;
      }

      if (toBlock - fromBlock > 10000) {
        res.status(400).json({
          success: false,
          message: '查询区块范围不能超过10000个区块',
          data: null,
        });
        return;
      }

      const transfers = await this.transferService.getTransfersByBlockRange(fromBlock, toBlock);

      res.status(200).json({
        success: true,
        message: '获取Transfer记录成功',
        data: {
          transfers,
          fromBlock,
          toBlock,
          count: transfers.length,
        },
      });
    } catch (error: any) {
      console.error('根据区块范围获取Transfer记录失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 清理过期的Transfer记录
   */
  public cleanupOldTransfers = async (req: Request, res: Response): Promise<void> => {
    try {
      const daysOld = parseInt(req.body.daysOld) || 30;

      if (daysOld < 7) {
        res.status(400).json({
          success: false,
          message: '保留天数不能少于7天',
          data: null,
        });
        return;
      }

      const deletedCount = await this.transferService.cleanupOldTransfers(daysOld);

      res.status(200).json({
        success: true,
        message: '清理过期Transfer记录成功',
        data: {
          deletedCount,
          daysOld,
        },
      });
    } catch (error: any) {
      console.error('清理过期Transfer记录失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };
}
