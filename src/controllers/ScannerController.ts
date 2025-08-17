import { Request, Response } from 'express';
import { ScannerService } from '../services/ScannerService';

export class ScannerController {
  private scannerService: ScannerService;

  constructor(scannerService: ScannerService) {
    this.scannerService = scannerService;
  }

  /**
   * 获取扫描状态
   */
  public getStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const status = await this.scannerService.getStatus();

      res.status(200).json({
        success: true,
        message: '获取扫描状态成功',
        data: status,
      });
    } catch (error: any) {
      console.error('获取扫描状态失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 启动扫描服务
   */
  public startScanning = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.scannerService.startScanning();

      res.status(200).json({
        success: true,
        message: '扫描服务启动成功',
        data: null,
      });
    } catch (error: any) {
      console.error('启动扫描服务失败:', error);
      res.status(500).json({
        success: false,
        message: '启动扫描服务失败',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 停止扫描服务
   */
  public stopScanning = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.scannerService.stopScanning();

      res.status(200).json({
        success: true,
        message: '扫描服务停止成功',
        data: null,
      });
    } catch (error: any) {
      console.error('停止扫描服务失败:', error);
      res.status(500).json({
        success: false,
        message: '停止扫描服务失败',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 手动触发扫描
   */
  public manualScan = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.scannerService.manualScan();

      res.status(200).json({
        success: true,
        message: '手动扫描完成',
        data: result,
      });
    } catch (error: any) {
      console.error('手动扫描失败:', error);
      res.status(500).json({
        success: false,
        message: '手动扫描失败',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 重扫指定区块范围
   */
  public rescanBlocks = async (req: Request, res: Response): Promise<void> => {
    try {
      const { fromBlock, toBlock } = req.body;

      // 验证参数
      if (!fromBlock || !toBlock || typeof fromBlock !== 'number' || typeof toBlock !== 'number') {
        res.status(400).json({
          success: false,
          message: '请提供有效的区块范围 (fromBlock, toBlock)',
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
          message: '单次重扫区块范围不能超过10000个区块',
          data: null,
        });
        return;
      }

      // 异步执行重扫，不阻塞响应
      this.scannerService.rescanMissingBlocks(fromBlock, toBlock).catch(error => {
        console.error('重扫区块失败:', error);
      });

      res.status(202).json({
        success: true,
        message: `已开始重扫区块 ${fromBlock} - ${toBlock}`,
        data: {
          fromBlock,
          toBlock,
          totalBlocks: toBlock - fromBlock + 1,
        },
      });
    } catch (error: any) {
      console.error('重扫区块失败:', error);
      res.status(500).json({
        success: false,
        message: '重扫区块失败',
        data: null,
        error: error.message,
      });
    }
  };
}
