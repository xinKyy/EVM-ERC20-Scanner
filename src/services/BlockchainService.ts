import Web3 from 'web3';
import { config } from '../config';
import { EventLog } from 'web3-types';
import { Web3Pool } from './Web3Pool';

// USDT Transfer事件的ABI
const TRANSFER_EVENT_ABI = {
  anonymous: false,
  inputs: [
    {
      indexed: true,
      internalType: 'address',
      name: 'from',
      type: 'address'
    },
    {
      indexed: true,
      internalType: 'address',
      name: 'to',
      type: 'address'
    },
    {
      indexed: false,
      internalType: 'uint256',
      name: 'value',
      type: 'uint256'
    }
  ],
  name: 'Transfer',
  type: 'event'
};

export interface TransferEvent {
  transactionHash: string;
  blockNumber: number;
  fromAddress: string;
  toAddress: string;
  amount: string;
  logIndex: number;
  transactionIndex: number;
}

export class BlockchainService {
  private web3Pool: Web3Pool;
  private usdtContractAddress: string;
  private transferEventSignature: string;

  constructor() {
    this.web3Pool = Web3Pool.getInstance();
    this.usdtContractAddress = config.usdt.contractAddress.toLowerCase();
    
    // Transfer事件签名: Transfer(address,address,uint256)
    const web3 = this.web3Pool.getWeb3();
    this.transferEventSignature = web3.eth.abi.encodeEventSignature(TRANSFER_EVENT_ABI);
    this.web3Pool.releaseConnection();
  }

  /**
   * 获取Web3实例
   */
  private getWeb3(): Web3 {
    return this.web3Pool.getWeb3();
  }

  /**
   * 获取当前最新区块号
   * @returns 最新区块号
   */
  public async getLatestBlockNumber(): Promise<number> {
    const web3 = this.getWeb3();
    try {
      const latestBlock = await web3.eth.getBlockNumber();
      return Number(latestBlock);
    } catch (error) {
      console.error('获取最新区块号失败:', error);
      throw error;
    }
  }

  /**
   * 获取指定区块的详细信息
   * @param blockNumber 区块号
   * @returns 区块信息
   */
  public async getBlock(blockNumber: number) {
    const web3 = this.getWeb3();
    try {
      return await web3.eth.getBlock(blockNumber, true);
    } catch (error) {
      console.error(`获取区块 ${blockNumber} 信息失败:`, error);
      throw error;
    }
  }

  /**
   * 扫描指定区块范围内的USDT Transfer事件（优化版）
   * @param fromBlock 起始区块
   * @param toBlock 结束区块
   * @returns Transfer事件列表
   */
  public async scanTransferEvents(fromBlock: number, toBlock: number): Promise<TransferEvent[]> {
    const web3 = this.getWeb3();
    const scanStartTime = Date.now();
    
    try {
      console.log(`🔍 开始扫描区块 ${fromBlock} 到 ${toBlock} 的USDT Transfer事件`);

      // 🚀 优化1: 动态分片查询，避免单次查询过大
      const blockRange = toBlock - fromBlock + 1;
      const maxBlocksPerQuery = 200; // 每次查询最多200个区块
      
      if (blockRange <= maxBlocksPerQuery) {
        // 小范围直接查询
        const logs = await this.getPastLogsWithRetry(web3, {
          fromBlock: fromBlock,
          toBlock: toBlock,
          address: this.usdtContractAddress,
          topics: [this.transferEventSignature],
        });
        
        const queryTime = Date.now() - scanStartTime;
        console.log(`📊 RPC查询耗时: ${queryTime}ms (${blockRange}个区块, ${logs.length}个日志)`);
        
        return await this.parseLogsInBatches(logs, web3);
      } else {
        // 大范围分片并发查询
        console.log(`📦 区块范围较大(${blockRange}个)，启用分片并发查询...`);
        return await this.scanTransferEventsInChunks(fromBlock, toBlock, maxBlocksPerQuery, web3);
      }
    } catch (error) {
      console.error(`扫描区块 ${fromBlock}-${toBlock} 失败:`, error);
      throw error;
    }
  }

  /**
   * 🚀 带重试机制的RPC查询
   */
  private async getPastLogsWithRetry(web3: Web3, params: any, maxRetries: number = 3): Promise<any[]> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const logs = await web3.eth.getPastLogs(params);
        const duration = Date.now() - startTime;
        
        if (attempt > 1) {
          console.log(`✅ RPC查询重试成功 (第${attempt}次尝试, 耗时${duration}ms)`);
        }
        
        return logs;
      } catch (error: any) {
        console.warn(`⚠️ RPC查询失败 (第${attempt}次尝试):`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // 指数退避重试
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ ${delay}ms后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('RPC查询重试次数已用完');
  }

  /**
   * 🚀 分片并发查询大范围区块
   */
  private async scanTransferEventsInChunks(
    fromBlock: number, 
    toBlock: number, 
    chunkSize: number, 
    web3: Web3
  ): Promise<TransferEvent[]> {
    const chunks: Array<{from: number, to: number}> = [];
    
    // 创建区块分片
    for (let start = fromBlock; start <= toBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, toBlock);
      chunks.push({ from: start, to: end });
    }
    
    console.log(`📦 分成 ${chunks.length} 个分片，每片最多 ${chunkSize} 个区块`);
    
    // 🚀 并发查询分片 (限制并发数避免RPC过载)
    const maxConcurrency = 5; // 最多5个并发RPC查询
    const allEvents: TransferEvent[] = [];
    
    for (let i = 0; i < chunks.length; i += maxConcurrency) {
      const currentChunks = chunks.slice(i, i + maxConcurrency);
      
      const chunkPromises = currentChunks.map(async (chunk, index) => {
        const chunkStartTime = Date.now();
        
        try {
          const logs = await this.getPastLogsWithRetry(web3, {
            fromBlock: chunk.from,
            toBlock: chunk.to,
            address: this.usdtContractAddress,
            topics: [this.transferEventSignature],
          });
          
          const queryTime = Date.now() - chunkStartTime;
          const blockCount = chunk.to - chunk.from + 1;
          console.log(`📊 分片${i + index + 1}查询完成: ${blockCount}个区块, ${logs.length}个日志, 耗时${queryTime}ms`);
          
          return await this.parseLogsInBatches(logs, web3);
        } catch (error) {
          console.error(`❌ 分片${i + index + 1}查询失败 (区块${chunk.from}-${chunk.to}):`, error);
          return [];
        }
      });
      
      const chunkResults = await Promise.all(chunkPromises);
      chunkResults.forEach(events => allEvents.push(...events));
      
      // 分片间添加小延迟，避免RPC过载
      if (i + maxConcurrency < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    console.log(`🎯 分片查询完成，总共找到 ${allEvents.length} 个Transfer事件`);
    return allEvents;
  }

  /**
   * 🚀 批量并发解析日志
   */
  private async parseLogsInBatches(logs: any[], web3: Web3): Promise<TransferEvent[]> {
    if (logs.length === 0) {
      return [];
    }

    // 对于大量日志，分批并发处理避免内存压力
    const batchSize = 1000; // 每批处理1000个日志
    const concurrency = Math.min(10, Math.ceil(logs.length / 100)); // 动态并发数
    const events: TransferEvent[] = [];
    
    if (logs.length > 500) {
      console.log(`🔄 开始并发解析 ${logs.length} 个日志，批次大小: ${batchSize}, 并发数: ${concurrency}`);
    }

    for (let i = 0; i < logs.length; i += batchSize) {
      const batch = logs.slice(i, i + batchSize);
      
      // 将批次进一步分割为并发块
      const chunkSize = Math.ceil(batch.length / concurrency);
      const chunks = [];
      
      for (let j = 0; j < batch.length; j += chunkSize) {
        chunks.push(batch.slice(j, j + chunkSize));
      }

      // 并发处理每个块
      const chunkPromises = chunks.map(async (chunk, chunkIndex) => {
        const chunkEvents: TransferEvent[] = [];
        
        for (const log of chunk) {
          try {
            const parsedEvent = this.parseTransferEvent(log as EventLog, web3);
            if (parsedEvent) {
              chunkEvents.push(parsedEvent);
            }
          } catch (error) {
            console.error(`解析Transfer事件失败 (批次${Math.floor(i/batchSize) + 1}, 块${chunkIndex + 1}):`, error);
          }
        }
        
        return chunkEvents;
      });

      // 等待当前批次的所有块完成
      const chunkResults = await Promise.all(chunkPromises);
      
      // 合并结果
      chunkResults.forEach(chunkEvents => {
        events.push(...chunkEvents);
      });

      // 如果有多个批次，添加小延迟避免CPU过载
      if (logs.length > batchSize && i + batchSize < logs.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    return events;
  }

  /**
   * 解析Transfer事件日志
   * @param log 事件日志
   * @param web3 Web3实例
   * @returns 解析后的Transfer事件
   */
  private parseTransferEvent(log: EventLog, web3: Web3): TransferEvent | null {
    try {
      // 验证日志结构
      if (!log.topics || log.topics.length !== 3 || !log.data) {
        console.warn('无效的Transfer事件日志结构:', log);
        return null;
      }

      // 解码事件参数
      const decoded = web3.eth.abi.decodeLog(
        TRANSFER_EVENT_ABI.inputs,
        log.data,
        log.topics.slice(1) // 去除事件签名topic
      );

      return {
        transactionHash: log.transactionHash || '',
        blockNumber: Number(log.blockNumber),
        fromAddress: (decoded.from as string).toLowerCase(),
        toAddress: (decoded.to as string).toLowerCase(),
        amount: decoded.value as string,
        logIndex: Number(log.logIndex || 0),
        transactionIndex: Number(log.transactionIndex || 0),
      };
    } catch (error) {
      console.error('解析Transfer事件失败:', error);
      return null;
    }
  }

  /**
   * 将Wei转换为USDT格式（18位小数）
   * @param weiAmount Wei数量
   * @returns 格式化的USDT数量
   */
  public formatUSDTAmount(weiAmount: string): string {
    const web3 = this.getWeb3();
    try {
      const amount = web3.utils.fromWei(weiAmount, 'ether');
      return parseFloat(amount).toFixed(6); // 保留6位小数
    } catch (error) {
      console.error('格式化USDT数量失败:', error);
      return '0.000000';
    }
  }

  /**
   * 获取交易详情
   * @param txHash 交易哈希
   * @returns 交易详情
   */
  public async getTransaction(txHash: string) {
    const web3 = this.getWeb3();
    try {
      return await web3.eth.getTransaction(txHash);
    } catch (error) {
      console.error(`获取交易 ${txHash} 详情失败:`, error);
      throw error;
    }
  }

  /**
   * 获取交易收据
   * @param txHash 交易哈希
   * @returns 交易收据
   */
  public async getTransactionReceipt(txHash: string) {
    const web3 = this.getWeb3();
    try {
      return await web3.eth.getTransactionReceipt(txHash);
    } catch (error) {
      console.error(`获取交易收据 ${txHash} 失败:`, error);
      throw error;
    }
  }

  /**
   * 验证地址格式
   * @param address 地址
   * @returns 是否有效
   */
  public isValidAddress(address: string): boolean {
    const web3 = this.getWeb3();
    return web3.utils.isAddress(address);
  }

  /**
   * 检查网络连接
   * @returns 是否连接正常
   */
  public async checkConnection(): Promise<boolean> {
    const web3 = this.getWeb3();
    try {
      await web3.eth.getBlockNumber();
      return true;
    } catch (error) {
      console.error('区块链网络连接检查失败:', error);
      return false;
    }
  }

  /**
   * 获取网络信息
   * @returns 网络ID和最新区块
   */
  public async getNetworkInfo(): Promise<{
    networkId: number;
    latestBlock: number;
    gasPrice: string;
  }> {
    const web3 = this.getWeb3();
    try {
      const [networkId, latestBlock, gasPrice] = await Promise.all([
        web3.eth.net.getId(),
        web3.eth.getBlockNumber(),
        web3.eth.getGasPrice(),
      ]);

      return {
        networkId: Number(networkId),
        latestBlock: Number(latestBlock),
        gasPrice: gasPrice.toString(),
      };
    } catch (error) {
      console.error('获取网络信息失败:', error);
      throw error;
    }
  }

  /**
   * 批量扫描多个区块范围
   * @param ranges 区块范围数组
   * @returns 所有Transfer事件
   */
  public async scanMultipleRanges(ranges: Array<{from: number, to: number}>): Promise<TransferEvent[]> {
    const allEvents: TransferEvent[] = [];
    
    for (const range of ranges) {
      try {
        const events = await this.scanTransferEvents(range.from, range.to);
        allEvents.push(...events);
        
        // 添加小延迟避免RPC限流
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`扫描区块范围 ${range.from}-${range.to} 失败:`, error);
        // 继续处理其他范围
      }
    }

    return allEvents;
  }

  /**
   * 重新连接到区块链网络
   */
  public async reconnect(): Promise<void> {
    try {
      // 使用连接池重连
      await this.web3Pool.reconnect();
      console.log('区块链网络重连成功');
    } catch (error) {
      console.error('区块链网络重连失败:', error);
      throw error;
    }
  }
}
