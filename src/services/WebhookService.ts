import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import { config } from '../config';
import { ITransfer } from '../models';

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
   * 延迟函数
   * @param ms 毫秒
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
