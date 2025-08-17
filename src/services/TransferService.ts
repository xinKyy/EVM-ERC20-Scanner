import { Transfer, ITransfer, TransferStatus } from '../models';
import { TransferEvent } from './BlockchainService';

export class TransferService {
  /**
   * 保存Transfer事件到数据库
   * @param event Transfer事件
   * @param amountFormatted 格式化的金额
   * @returns 保存的Transfer记录
   */
  public async saveTransferEvent(
    event: TransferEvent, 
    amountFormatted: string
  ): Promise<ITransfer | null> {
    try {
      // 检查是否已存在
      const existingTransfer = await Transfer.findOne({
        transactionHash: event.transactionHash,
      });

      if (existingTransfer) {
        console.log(`交易 ${event.transactionHash} 已存在，跳过保存`);
        return existingTransfer;
      }

      // 创建新的Transfer记录
      const transfer = new Transfer({
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        fromAddress: event.fromAddress,
        toAddress: event.toAddress,
        amount: event.amount,
        amountFormatted: amountFormatted,
        status: TransferStatus.PENDING,
        confirmationCount: 0,
        webhookSent: false,
      });

      const savedTransfer = await transfer.save();
      console.log(`保存新的Transfer记录: ${event.transactionHash}`);
      
      return savedTransfer;
    } catch (error) {
      console.error('保存Transfer事件失败:', error);
      return null;
    }
  }

  /**
   * 批量保存Transfer事件
   * @param events Transfer事件列表
   * @param formatAmountFn 格式化金额的函数
   * @returns 保存成功的数量
   */
  public async batchSaveTransferEvents(
    events: TransferEvent[],
    formatAmountFn: (amount: string) => string
  ): Promise<number> {
    let savedCount = 0;

    for (const event of events) {
      try {
        const amountFormatted = formatAmountFn(event.amount);
        const transfer = await this.saveTransferEvent(event, amountFormatted);
        
        if (transfer) {
          savedCount++;
        }
      } catch (error) {
        console.error(`批量保存Transfer事件失败 ${event.transactionHash}:`, error);
      }
    }

    console.log(`批量保存完成，成功保存 ${savedCount}/${events.length} 个Transfer事件`);
    return savedCount;
  }

  /**
   * 更新Transfer确认状态
   * @param currentBlockNumber 当前区块号
   * @param confirmationBlocks 需要的确认区块数
   * @returns 更新的记录数量
   */
  public async updateConfirmationStatus(
    currentBlockNumber: number,
    confirmationBlocks: number
  ): Promise<number> {
    try {
      // 更新确认数量
      const pendingTransfers = await Transfer.find({
        status: TransferStatus.PENDING,
      });

      let updatedCount = 0;

      for (const transfer of pendingTransfers) {
        const confirmationCount = currentBlockNumber - transfer.blockNumber;
        
        // 更新确认数量
        transfer.confirmationCount = Math.max(0, confirmationCount);

        // 检查是否达到确认要求
        if (confirmationCount >= confirmationBlocks) {
          transfer.status = TransferStatus.CONFIRMED;
          console.log(`交易 ${transfer.transactionHash} 已确认 (${confirmationCount} 确认)`);
        }

        await transfer.save();
        updatedCount++;
      }

      return updatedCount;
    } catch (error) {
      console.error('更新确认状态失败:', error);
      return 0;
    }
  }

  /**
   * 获取需要发送Webhook的Transfer记录
   * @param limit 限制数量
   * @returns Transfer记录列表
   */
  public async getTransfersForWebhook(limit: number = 100): Promise<ITransfer[]> {
    try {
      return await Transfer.find({
        status: TransferStatus.CONFIRMED,
        webhookSent: false,
      })
      .sort({ blockNumber: 1 }) // 按区块号升序
      .limit(limit);
    } catch (error) {
      console.error('获取待发送Webhook的Transfer失败:', error);
      return [];
    }
  }

  /**
   * 标记Webhook已发送
   * @param transferIds Transfer ID列表
   * @returns 更新的数量
   */
  public async markWebhookSent(transferIds: string[]): Promise<number> {
    try {
      const result = await Transfer.updateMany(
        { _id: { $in: transferIds } },
        { 
          webhookSent: true,
          webhookSentAt: new Date(),
        }
      );

      console.log(`标记 ${result.modifiedCount} 个Transfer的Webhook已发送`);
      return result.modifiedCount || 0;
    } catch (error) {
      console.error('标记Webhook已发送失败:', error);
      return 0;
    }
  }

  /**
   * 获取Transfer统计信息
   * @returns 统计信息
   */
  public async getStatistics(): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    webhookSent: number;
    todayCount: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        total,
        pending,
        confirmed,
        webhookSent,
        todayCount,
      ] = await Promise.all([
        Transfer.countDocuments(),
        Transfer.countDocuments({ status: TransferStatus.PENDING }),
        Transfer.countDocuments({ status: TransferStatus.CONFIRMED }),
        Transfer.countDocuments({ webhookSent: true }),
        Transfer.countDocuments({ createdAt: { $gte: today } }),
      ]);

      return {
        total,
        pending,
        confirmed,
        webhookSent,
        todayCount,
      };
    } catch (error) {
      console.error('获取Transfer统计信息失败:', error);
      return {
        total: 0,
        pending: 0,
        confirmed: 0,
        webhookSent: 0,
        todayCount: 0,
      };
    }
  }

  /**
   * 获取指定地址的Transfer记录
   * @param address 地址
   * @param limit 限制数量
   * @param offset 偏移量
   * @returns Transfer记录列表
   */
  public async getTransfersByAddress(
    address: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    transfers: ITransfer[];
    total: number;
  }> {
    try {
      const query = { toAddress: address.toLowerCase() };
      
      const [transfers, total] = await Promise.all([
        Transfer.find(query)
          .sort({ blockNumber: -1 })
          .limit(limit)
          .skip(offset),
        Transfer.countDocuments(query),
      ]);

      return { transfers, total };
    } catch (error) {
      console.error('获取地址Transfer记录失败:', error);
      return { transfers: [], total: 0 };
    }
  }

  /**
   * 删除过期的Transfer记录
   * @param daysOld 保留天数
   * @returns 删除的数量
   */
  public async cleanupOldTransfers(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await Transfer.deleteMany({
        createdAt: { $lt: cutoffDate },
        webhookSent: true, // 只删除已发送Webhook的记录
      });

      console.log(`清理了 ${result.deletedCount} 个过期的Transfer记录`);
      return result.deletedCount || 0;
    } catch (error) {
      console.error('清理过期Transfer记录失败:', error);
      return 0;
    }
  }

  /**
   * 重试失败的Webhook
   * @param maxRetries 最大重试次数
   * @returns 重试的Transfer列表
   */
  public async getFailedWebhookTransfers(maxRetries: number = 3): Promise<ITransfer[]> {
    try {
      // 这里可以根据需求实现失败重试逻辑
      // 例如：查找webhookSent为false但已确认超过一定时间的记录
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      return await Transfer.find({
        status: TransferStatus.CONFIRMED,
        webhookSent: false,
        updatedAt: { $lt: oneHourAgo },
      })
      .limit(50);
    } catch (error) {
      console.error('获取失败的Webhook Transfer失败:', error);
      return [];
    }
  }

  /**
   * 根据区块号范围获取Transfer记录
   * @param fromBlock 起始区块
   * @param toBlock 结束区块
   * @returns Transfer记录列表
   */
  public async getTransfersByBlockRange(
    fromBlock: number,
    toBlock: number
  ): Promise<ITransfer[]> {
    try {
      return await Transfer.find({
        blockNumber: {
          $gte: fromBlock,
          $lte: toBlock,
        },
      }).sort({ blockNumber: 1 });
    } catch (error) {
      console.error('根据区块范围获取Transfer失败:', error);
      return [];
    }
  }
}
