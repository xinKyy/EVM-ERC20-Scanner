import { Request, Response } from 'express';
import { AddressService } from '../services/AddressService';

export class AddressController {
  private addressService: AddressService;

  constructor() {
    this.addressService = new AddressService();
  }

  /**
   * 订阅地址接口
   */
  public subscribe = async (req: Request, res: Response): Promise<void> => {
    try {
      const { addresses } = req.body;

      // 验证请求体
      if (!addresses || !Array.isArray(addresses)) {
        res.status(400).json({
          success: false,
          message: '请提供有效的地址数组',
          data: null,
        });
        return;
      }

      if (addresses.length === 0) {
        res.status(400).json({
          success: false,
          message: '地址数组不能为空',
          data: null,
        });
        return;
      }

      if (addresses.length > 1000) {
        res.status(400).json({
          success: false,
          message: '单次最多只能订阅1000个地址',
          data: null,
        });
        return;
      }

      // 验证地址格式
      const invalidAddresses = addresses.filter((addr: any) => 
        typeof addr !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(addr)
      );

      if (invalidAddresses.length > 0) {
        res.status(400).json({
          success: false,
          message: '存在无效的地址格式',
          data: {
            invalidAddresses: invalidAddresses.slice(0, 10), // 只返回前10个无效地址
            invalidCount: invalidAddresses.length,
          },
        });
        return;
      }

      // 执行订阅
      const result = await this.addressService.subscribeAddresses(addresses);

      res.status(200).json({
        success: true,
        message: '地址订阅成功',
        data: {
          newAddresses: result.newAddresses,
          totalAddresses: result.totalAddresses,
          addedAddresses: result.addedAddresses,
          requestedAddresses: addresses.length,
        },
      });
    } catch (error: any) {
      console.error('订阅地址失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 取消订阅地址接口
   */
  public unsubscribe = async (req: Request, res: Response): Promise<void> => {
    try {
      const { addresses } = req.body;

      if (!addresses || !Array.isArray(addresses)) {
        res.status(400).json({
          success: false,
          message: '请提供有效的地址数组',
          data: null,
        });
        return;
      }

      const deletedCount = await this.addressService.unsubscribeAddresses(addresses);

      res.status(200).json({
        success: true,
        message: '取消订阅成功',
        data: {
          deletedCount,
          requestedAddresses: addresses.length,
        },
      });
    } catch (error: any) {
      console.error('取消订阅失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 获取订阅的地址列表
   */
  public getAddresses = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 1000);
      const skip = (page - 1) * limit;

      const addresses = await this.addressService.getAllSubscribedAddresses();
      const paginatedAddresses = addresses.slice(skip, skip + limit);

      res.status(200).json({
        success: true,
        message: '获取地址列表成功',
        data: {
          addresses: paginatedAddresses,
          pagination: {
            page,
            limit,
            total: addresses.length,
            totalPages: Math.ceil(addresses.length / limit),
          },
        },
      });
    } catch (error: any) {
      console.error('获取地址列表失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 检查地址订阅状态
   */
  public checkSubscription = async (req: Request, res: Response): Promise<void> => {
    try {
      const { address } = req.params;

      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        res.status(400).json({
          success: false,
          message: '无效的地址格式',
          data: null,
        });
        return;
      }

      const isSubscribed = await this.addressService.isAddressSubscribed(address);

      res.status(200).json({
        success: true,
        message: '检查订阅状态成功',
        data: {
          address,
          isSubscribed,
        },
      });
    } catch (error: any) {
      console.error('检查订阅状态失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };

  /**
   * 获取订阅统计信息
   */
  public getStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.addressService.getStatistics();

      res.status(200).json({
        success: true,
        message: '获取统计信息成功',
        data: stats,
      });
    } catch (error: any) {
      console.error('获取统计信息失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        data: null,
        error: error.message,
      });
    }
  };
}
