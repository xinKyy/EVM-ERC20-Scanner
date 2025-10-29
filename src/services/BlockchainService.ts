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
   * 扫描指定区块范围内的USDT Transfer事件
   * @param fromBlock 起始区块
   * @param toBlock 结束区块
   * @returns Transfer事件列表
   */
  public async scanTransferEvents(fromBlock: number, toBlock: number): Promise<TransferEvent[]> {
    const web3 = this.getWeb3();
    try {
      console.log(`开始扫描区块 ${fromBlock} 到 ${toBlock} 的USDT Transfer事件`);

      const logs = await web3.eth.getPastLogs({
        fromBlock: fromBlock,
        toBlock: toBlock,
        address: this.usdtContractAddress,
        topics: [this.transferEventSignature],
      });

      const events: TransferEvent[] = [];

      for (const log of logs) {
        try {
          const parsedEvent = this.parseTransferEvent(log as EventLog, web3);
          if (parsedEvent) {
            events.push(parsedEvent);
          }
        } catch (error) {
          console.error('解析Transfer事件失败:', error, log);
        }
      }

      console.log(`扫描完成，找到 ${events.length} 个Transfer事件`);
      return events;
    } catch (error) {
      console.error(`扫描区块 ${fromBlock}-${toBlock} 失败:`, error);
      throw error;
    }
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
