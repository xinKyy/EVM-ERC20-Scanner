import { Address, IAddress } from '../models';

export class AddressService {
  /**
   * 订阅地址列表（去重存储）
   * @param addresses 地址数组
   * @returns 新增的地址数量和总地址数量
   */
  public async subscribeAddresses(addresses: string[]): Promise<{
    newAddresses: number;
    totalAddresses: number;
    addedAddresses: string[];
  }> {
    try {
      // 转换为小写并去重
      const uniqueAddresses = [...new Set(
        addresses
          .filter(addr => this.isValidAddress(addr))
          .map(addr => addr.toLowerCase())
      )];

      if (uniqueAddresses.length === 0) {
        throw new Error('没有有效的地址');
      }

      const addedAddresses: string[] = [];
      let newCount = 0;

      // 批量插入，忽略重复的地址
      for (const address of uniqueAddresses) {
        try {
          const newAddress = new Address({ address });
          await newAddress.save();
          addedAddresses.push(address);
          newCount++;
        } catch (error: any) {
          // 如果是重复键错误（11000），忽略
          if (error.code !== 11000) {
            console.error(`保存地址 ${address} 失败:`, error);
          }
        }
      }

      // 获取总地址数量
      const totalCount = await Address.countDocuments();

      console.log(`成功添加 ${newCount} 个新地址，总共 ${totalCount} 个地址`);

      return {
        newAddresses: newCount,
        totalAddresses: totalCount,
        addedAddresses,
      };
    } catch (error) {
      console.error('订阅地址失败:', error);
      throw error;
    }
  }

  /**
   * 检查地址是否已订阅
   * @param address 地址
   * @returns 是否已订阅
   */
  public async isAddressSubscribed(address: string): Promise<boolean> {
    try {
      const result = await Address.findOne({ 
        address: address.toLowerCase() 
      });
      return !!result;
    } catch (error) {
      console.error('检查地址订阅状态失败:', error);
      return false;
    }
  }

  /**
   * 批量检查地址是否已订阅
   * @param addresses 地址数组
   * @returns 已订阅的地址集合
   */
  public async getSubscribedAddresses(addresses: string[]): Promise<Set<string>> {
    try {
      const lowerAddresses = addresses.map(addr => addr.toLowerCase());
      const subscribedAddresses = await Address.find({
        address: { $in: lowerAddresses }
      }).select('address');

      return new Set(subscribedAddresses.map(doc => doc.address));
    } catch (error) {
      console.error('批量检查地址订阅状态失败:', error);
      return new Set();
    }
  }

  /**
   * 获取所有订阅的地址
   * @returns 地址列表
   */
  public async getAllSubscribedAddresses(): Promise<string[]> {
    try {
      const addresses = await Address.find({}).select('address');
      return addresses.map(doc => doc.address);
    } catch (error) {
      console.error('获取所有订阅地址失败:', error);
      return [];
    }
  }

  /**
   * 取消订阅地址
   * @param addresses 地址数组
   * @returns 删除的地址数量
   */
  public async unsubscribeAddresses(addresses: string[]): Promise<number> {
    try {
      const lowerAddresses = addresses.map(addr => addr.toLowerCase());
      const result = await Address.deleteMany({
        address: { $in: lowerAddresses }
      });

      console.log(`成功删除 ${result.deletedCount} 个地址`);
      return result.deletedCount || 0;
    } catch (error) {
      console.error('取消订阅地址失败:', error);
      throw error;
    }
  }

  /**
   * 验证地址格式
   * @param address 地址
   * @returns 是否有效
   */
  private isValidAddress(address: string): boolean {
    // 以太坊地址格式验证：0x开头，42位长度，包含16进制字符
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    return addressRegex.test(address);
  }

  /**
   * 获取订阅统计信息
   * @returns 统计信息
   */
  public async getStatistics(): Promise<{
    totalAddresses: number;
    createdToday: number;
  }> {
    try {
      const totalAddresses = await Address.countDocuments();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const createdToday = await Address.countDocuments({
        createdAt: { $gte: today }
      });

      return {
        totalAddresses,
        createdToday,
      };
    } catch (error) {
      console.error('获取统计信息失败:', error);
      return {
        totalAddresses: 0,
        createdToday: 0,
      };
    }
  }
}
