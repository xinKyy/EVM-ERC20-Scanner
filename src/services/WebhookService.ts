import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import { config } from '../config';
import { ITransfer, IWithdrawalRecord, PendingCallback, IPendingCallback } from '../models';

export interface WebhookPayload {
  type: 'usdt_transfer';
  data: {
    transactionHash: string;
    blockNumber: number;
    fromAddress: string;
    toAddress: string;
    amount: string;
    amountFormatted: string;
    timestamp: string;
  };
  signature?: string;
}

// 新的充值回调接口
export interface DepositCallbackPayload {
  amount: string;
  currency: string;
  fromAddress: string;
  hash: string;
  sign: string;
  timestamp: string;
  toAddress: string;
  userId: string;
  walletType: string; // 1:ERC20
}

// 新的提现回调接口
export interface WithdrawalCallbackPayload {
  address: string;
  amount: string;
  hash: string;
  sign: string;
  timestamp: string;
  transId: string;
  transferStatus: string; // 0:提现申请成功，1:提现成功 2:转账失败
}

export class WebhookService {
  private readonly webhookUrl: string;
  private readonly webhookSecret: string;
  private readonly timeout: number = 10000; // 10秒超时
  private readonly maxRetries: number = 3;

  constructor() {
    this.webhookUrl = config.webhook.url;
    this.webhookSecret = config.webhook.secret;
  }

  /**
   * 发送Webhook通知
   * @param transfer 转账记录
   * @returns 是否发送成功
   */
  public async sendTransferNotification(transfer: ITransfer): Promise<boolean> {
    try {
      const payload = this.createPayload(transfer);
      console.log(transfer, "转账log")
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const response = await this.sendWebhook(payload);

          if (response.status >= 200 && response.status < 300) {
            console.log(`Webhook发送成功: ${transfer.transactionHash}`);
            return true;
          } else {
            console.warn(`Webhook响应状态异常 ${response.status}: ${transfer.transactionHash}`);
          }
        } catch (error: any) {
          console.error(`Webhook发送失败 (尝试 ${attempt}/${this.maxRetries}):`, {
            transactionHash: transfer.transactionHash,
            error: error.message,
          });

          if (attempt === this.maxRetries) {
            return false;
          }

          // 指数退避重试
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }

      return false;
    } catch (error) {
      console.error('创建Webhook负载失败:', error);
      return false;
    }
  }

  /**
   * 批量发送Webhook通知
   * @param transfers 转账记录列表
   * @returns 发送结果统计
   */
  public async sendBatchNotifications(transfers: ITransfer[]): Promise<{
    successful: number;
    failed: number;
    failedHashes: string[];
  }> {
    const results = {
      successful: 0,
      failed: 0,
      failedHashes: [] as string[],
    };

    for (const transfer of transfers) {
      const success = await this.sendTransferNotification(transfer);

      if (success) {
        results.successful++;
      } else {
        results.failed++;
        results.failedHashes.push(transfer.transactionHash);
      }

      // 避免频繁请求，添加小延迟
      await this.sleep(100);
    }

    console.log(`批量Webhook发送完成: 成功 ${results.successful}, 失败 ${results.failed}`);
    return results;
  }

  /**
   * 创建Webhook负载
   * @param transfer 转账记录
   * @returns Webhook负载
   */
  private createPayload(transfer: ITransfer): WebhookPayload {
    const payload: WebhookPayload = {
      type: 'usdt_transfer',
      data: {
        transactionHash: transfer.transactionHash,
        blockNumber: transfer.blockNumber,
        fromAddress: transfer.fromAddress,
        toAddress: transfer.toAddress,
        amount: transfer.amount,
        amountFormatted: transfer.amountFormatted,
        timestamp: transfer.createdAt.toISOString(),
      },
    };

    // 生成签名
    if (this.webhookSecret) {
      const data = JSON.stringify(payload.data);
      payload.signature = this.generateSignature(data);
    }

    return payload;
  }

  /**
   * 发送Webhook请求
   * @param payload 负载数据
   * @returns 响应结果
   */
  private async sendWebhook(payload: WebhookPayload): Promise<AxiosResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'BSC-USDT-Scanner/1.0',
    };

    if (payload.signature) {
      headers['X-Signature'] = payload.signature;
    }

    return await axios.post(this.webhookUrl, payload, {
      headers,
      timeout: this.timeout,
      validateStatus: (status) => status < 500, // 不要对4xx错误抛异常
    });
  }

  /**
   * 生成HMAC签名
   * @param data 数据
   * @returns 签名
   */
  private generateSignature(data: string): string {
    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(data)
      .digest('hex');
  }

  /**
   * 验证Webhook签名
   * @param data 数据
   * @param signature 签名
   * @returns 是否有效
   */
  public verifySignature(data: string, signature: string): boolean {
    if (!this.webhookSecret) {
      return true; // 如果没有设置密钥，跳过验证
    }

    const expectedSignature = this.generateSignature(data);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * 测试Webhook连接
   * @returns 是否连接成功
   */
  public async testConnection(): Promise<boolean> {
    try {
      const testPayload: WebhookPayload = {
        type: 'usdt_transfer',
        data: {
          transactionHash: '0x' + '0'.repeat(64),
          blockNumber: 0,
          fromAddress: '0x' + '0'.repeat(40),
          toAddress: '0x' + '0'.repeat(40),
          amount: '0',
          amountFormatted: '0.00',
          timestamp: new Date().toISOString(),
        },
      };

      if (this.webhookSecret) {
        testPayload.signature = this.generateSignature(JSON.stringify(testPayload.data));
      }

      const response = await axios.post(this.webhookUrl, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BSC-USDT-Scanner/1.0 (Test)',
          ...(testPayload.signature && { 'X-Signature': testPayload.signature }),
        },
        timeout: this.timeout,
      });

      return response.status >= 200 && response.status < 300;
    } catch (error) {
      console.error('Webhook连接测试失败:', error);
      return false;
    }
  }

  /**
   * 发送充值回调通知
   * @param transfer 转账记录
   * @param userId 用户ID
   * @returns 是否发送成功
   */
  public async sendDepositCallback(transfer: ITransfer, userId: string): Promise<boolean> {
    try {
      const payload = this.createDepositPayload(transfer, userId);
      
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const response = await this.sendDepositWebhook(payload);

          if (response.status >= 200 && response.status < 300) {
            console.log(`充值回调发送成功: ${transfer.transactionHash}`);
            return true;
          } else {
            console.warn(`充值回调响应状态异常 ${response.status}: ${transfer.transactionHash}`);
          }
        } catch (error: any) {
          console.error(`充值回调发送失败 (尝试 ${attempt}/${this.maxRetries}):`, {
            transactionHash: transfer.transactionHash,
            error: error.message,
          });

          if (attempt === this.maxRetries) {
            return false;
          }

          // 指数退避重试
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }

      return false;
    } catch (error) {
      console.error('创建充值回调负载失败:', error);
      return false;
    }
  }

  /**
   * 发送提现回调通知
   * @param withdrawal 提现记录
   * @param transferStatus 提现状态 0:提现申请成功，1:提现成功 2:转账失败
   * @returns 是否发送成功
   */
  public async sendWithdrawalCallback(withdrawal: IWithdrawalRecord, transferStatus: string): Promise<boolean> {
    try {
      const payload = this.createWithdrawalPayload(withdrawal, transferStatus);
      
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const response = await this.sendWithdrawalWebhook(payload);

          if (response.status >= 200 && response.status < 300) {
            console.log(`提现回调发送成功: ${withdrawal._id}`);
            return true;
          } else {
            console.warn(`提现回调响应状态异常 ${response.status}: ${withdrawal._id}`);
          }
        } catch (error: any) {
          console.error(`提现回调发送失败 (尝试 ${attempt}/${this.maxRetries}):`, {
            withdrawalId: withdrawal._id,
            error: error.message,
          });

          if (attempt === this.maxRetries) {
            // 立即重试失败，添加到重试队列
            await this.addPendingCallback(
              'withdrawal',
              withdrawal._id.toString(),
              payload,
              config.webhook.withdrawalCallbackUrl,
              transferStatus
            );
            return false;
          }

          // 指数退避重试
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }

      return false;
    } catch (error) {
      console.error('创建提现回调负载失败:', error);
      return false;
    }
  }

  /**
   * 创建充值回调负载
   * @param transfer 转账记录
   * @param userId 用户ID
   * @returns 充值回调负载
   */
  private createDepositPayload(transfer: ITransfer, userId: string): DepositCallbackPayload {
    const timestamp = Date.now().toString();
    
    const payload: DepositCallbackPayload = {
      amount: transfer.amountFormatted,
      currency: 'USDT',
      fromAddress: transfer.fromAddress,
      hash: transfer.transactionHash,
      timestamp,
      toAddress: transfer.toAddress,
      userId,
      walletType: '1', // 1:ERC20
      sign: '', // 将在下面生成
    };

    // 生成签名
    payload.sign = this.generateCallbackSignature(payload);

    return payload;
  }

  /**
   * 创建提现回调负载
   * @param withdrawal 提现记录
   * @param transferStatus 提现状态
   * @returns 提现回调负载
   */
  private createWithdrawalPayload(withdrawal: IWithdrawalRecord, transferStatus: string): WithdrawalCallbackPayload {
    const timestamp = Date.now().toString();
    
    const payload: WithdrawalCallbackPayload = {
      address: withdrawal.toAddress,
      amount: withdrawal.amountFormatted,
      hash: withdrawal.transactionHash || '',
      timestamp,
      transId: withdrawal.transId || withdrawal._id.toString(), // 优先使用外部transId，否则使用内部ID
      transferStatus,
      sign: '', // 将在下面生成
    };

    // 生成签名
    payload.sign = this.generateCallbackSignature(payload);

    return payload;
  }

  /**
   * 发送充值Webhook请求
   * @param payload 负载数据
   * @returns 响应结果
   */
  private async sendDepositWebhook(payload: DepositCallbackPayload): Promise<AxiosResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'BSC-USDT-Scanner/1.0',
    };

    return await axios.post(config.webhook.depositCallbackUrl, payload, {
      headers,
      timeout: this.timeout,
      validateStatus: (status) => status < 500, // 不要对4xx错误抛异常
    });
  }

  /**
   * 发送提现Webhook请求
   * @param payload 负载数据
   * @returns 响应结果
   */
  private async sendWithdrawalWebhook(payload: WithdrawalCallbackPayload): Promise<AxiosResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'BSC-USDT-Scanner/1.0',
    };

    return await axios.post(config.webhook.withdrawalCallbackUrl, payload, {
      headers,
      timeout: this.timeout,
      validateStatus: (status) => status < 500, // 不要对4xx错误抛异常
    });
  }

  /**
   * 生成回调签名
   * @param payload 负载数据
   * @returns 签名
   */
  private generateCallbackSignature(payload: any): string {
    // 排除sign字段，按字母顺序排序参数
    const params = Object.keys(payload)
      .filter(key => key !== 'sign')
      .sort()
      .map(key => `${key}=${payload[key]}`)
      .join('&');
    
    // 添加密钥
    const signString = params + '&key=' + this.webhookSecret;
    
    // 生成MD5签名并转大写
    return crypto.createHash('md5').update(signString).digest('hex').toUpperCase();
  }

  /**
   * 延迟函数
   * @param ms 毫秒
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 添加待重试的回调
   * @param type 回调类型
   * @param relatedId 关联记录ID
   * @param payload 回调负载
   * @param url 回调URL
   * @param transferStatus 提现状态（可选）
   */
  public async addPendingCallback(
    type: 'withdrawal' | 'deposit',
    relatedId: string,
    payload: any,
    url: string,
    transferStatus?: string
  ): Promise<void> {
    try {
      // 检查是否已存在相同的待重试回调
      const existingCallback = await PendingCallback.findOne({
        type,
        relatedId,
        transferStatus,
        status: 'pending'
      });

      if (existingCallback) {
        console.log(`回调已存在于重试队列中: ${type} ${relatedId} ${transferStatus || ''}`);
        return;
      }

      // 创建新的待重试回调
      const pendingCallback = new PendingCallback({
        type,
        relatedId,
        payload,
        url,
        transferStatus,
        retryCount: 0,
        maxRetries: 20, // 最多重试20次
        nextRetryAt: new Date(Date.now() + 30 * 1000), // 30秒后重试
        status: 'pending'
      });

      await pendingCallback.save();
      console.log(`添加回调到重试队列: ${type} ${relatedId} ${transferStatus || ''}`);
    } catch (error) {
      console.error('添加待重试回调失败:', error);
    }
  }

  /**
   * 处理待重试的回调
   */
  public async processPendingCallbacks(): Promise<void> {
    try {
      const now = new Date();
      
      // 获取需要重试的回调，按relatedId去重
      const pendingCallbacks = await PendingCallback.aggregate([
        {
          $match: {
            status: 'pending',
            nextRetryAt: { $lte: now }
          }
        },
        {
          $sort: { nextRetryAt: 1, createdAt: 1 } // 按重试时间和创建时间排序
        },
        {
          $group: {
            _id: {
              type: '$type',
              relatedId: '$relatedId',
              transferStatus: '$transferStatus'
            },
            doc: { $first: '$$ROOT' } // 取每组的第一个文档
          }
        },
        {
          $replaceRoot: { newRoot: '$doc' } // 替换根文档
        },
        {
          $limit: 50
        }
      ]);

      if (pendingCallbacks.length === 0) {
        return;
      }

      console.log(`处理 ${pendingCallbacks.length} 个待重试回调`);

      for (const callbackData of pendingCallbacks) {
        // 获取实际的 Mongoose 文档
        const callback = await PendingCallback.findById(callbackData._id);
        if (callback && callback.status === 'pending') {
          await this.retryCallback(callback);
          // 避免频繁请求
          await this.sleep(500);
        }
      }
    } catch (error) {
      console.error('处理待重试回调失败:', error);
    }
  }

  /**
   * 重试单个回调
   * @param callback 待重试的回调
   */
  private async retryCallback(callback: IPendingCallback): Promise<void> {
    try {
      let success = false;

      // 根据回调类型发送请求
      if (callback.type === 'withdrawal') {
        success = await this.sendWithdrawalWebhookDirect(callback.payload, callback.url);
      } else if (callback.type === 'deposit') {
        success = await this.sendDepositWebhookDirect(callback.payload, callback.url);
      }

      if (success) {
        // 成功，标记为完成
        callback.status = 'completed';
        await callback.save();
        console.log(`回调重试成功: ${callback.type} ${callback.relatedId} ${callback.transferStatus || ''}`);
        
        // 删除或标记其他相同的待重试回调为已完成
        await PendingCallback.updateMany(
          {
            type: callback.type,
            relatedId: callback.relatedId,
            transferStatus: callback.transferStatus,
            status: 'pending',
            _id: { $ne: callback._id }
          },
          {
            status: 'completed',
            lastError: '其他重试任务已成功'
          }
        );
      } else {
        // 失败，更新重试信息
        callback.retryCount += 1;
        
        if (callback.retryCount >= callback.maxRetries) {
          // 达到最大重试次数，标记为失败
          callback.status = 'failed';
          console.error(`回调重试达到最大次数，标记为失败: ${callback.type} ${callback.relatedId} ${callback.transferStatus || ''}`);
        } else {
          // 计算下次重试时间（每次间隔30秒）
          callback.nextRetryAt = new Date(Date.now() + 30 * 1000);
          console.log(`回调重试失败，将在30秒后重试 (${callback.retryCount}/${callback.maxRetries}): ${callback.type} ${callback.relatedId} ${callback.transferStatus || ''}`);
        }
        
        await callback.save();
      }
    } catch (error) {
      console.error(`重试回调时发生错误: ${callback.type} ${callback.relatedId}`, error);
      
      // 更新错误信息
      callback.lastError = error.message;
      callback.retryCount += 1;
      
      if (callback.retryCount >= callback.maxRetries) {
        callback.status = 'failed';
      } else {
        callback.nextRetryAt = new Date(Date.now() + 30 * 1000);
      }
      
      await callback.save();
    }
  }

  /**
   * 直接发送提现回调（用于重试）
   * @param payload 回调负载
   * @param url 回调URL
   * @returns 是否成功
   */
  private async sendWithdrawalWebhookDirect(payload: any, url: string): Promise<boolean> {
    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      return response.status >= 200 && response.status < 300;
    } catch (error: any) {
      console.error('直接发送提现回调失败:', error.message);
      return false;
    }
  }

  /**
   * 直接发送充值回调（用于重试）
   * @param payload 回调负载
   * @param url 回调URL
   * @returns 是否成功
   */
  private async sendDepositWebhookDirect(payload: any, url: string): Promise<boolean> {
    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      return response.status >= 200 && response.status < 300;
    } catch (error: any) {
      console.error('直接发送充值回调失败:', error.message);
      return false;
    }
  }

  /**
   * 启动回调重试处理器
   */
  public startCallbackRetryProcessor(): void {
    console.log('启动回调重试处理器...');
    
    // 每30秒检查一次待重试的回调
    setInterval(async () => {
      await this.processPendingCallbacks();
    }, 30000);
  }

  /**
   * 清理旧的回调记录
   * @param daysOld 保留天数
   */
  public async cleanupOldCallbacks(daysOld: number = 7): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      
      const result = await PendingCallback.deleteMany({
        $or: [
          { status: 'completed', updatedAt: { $lt: cutoffDate } },
          { status: 'failed', updatedAt: { $lt: cutoffDate } }
        ]
      });

      if (result.deletedCount > 0) {
        console.log(`清理了 ${result.deletedCount} 条旧的回调记录`);
      }
    } catch (error) {
      console.error('清理旧回调记录失败:', error);
    }
  }
}
