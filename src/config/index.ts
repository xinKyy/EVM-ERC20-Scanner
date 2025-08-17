import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  bsc: {
    rpcUrl: string;
    wsUrl: string;
  };
  usdt: {
    contractAddress: string;
  };
  mongodb: {
    uri: string;
  };
  scanner: {
    startBlockNumber: number;
    confirmationBlocks: number;
    scanInterval: number;
  };
  webhook: {
    url: string;
    secret: string;
  };
  server: {
    port: number;
  };
  logLevel: string;
}

export const config: Config = {
  bsc: {
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/',
    wsUrl: process.env.BSC_WS_URL || 'wss://bsc-ws-node.nariox.org:443',
  },
  usdt: {
    contractAddress: process.env.USDT_CONTRACT_ADDRESS || '0x55d398326f99059fF775485246999027B3197955',
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bsc-scanner',
  },
  scanner: {
    startBlockNumber: parseInt(process.env.START_BLOCK_NUMBER || '34000000'),
    confirmationBlocks: parseInt(process.env.CONFIRMATION_BLOCKS || '6'),
    scanInterval: parseInt(process.env.SCAN_INTERVAL || '3000'),
  },
  webhook: {
    url: process.env.WEBHOOK_URL || 'http://localhost:8080/webhook/transfer',
    secret: process.env.WEBHOOK_SECRET || 'your_webhook_secret',
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};
