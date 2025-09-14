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
    database: string;
  };
  scanner: {
    startBlockNumber: number;
    confirmationBlocks: number;
    scanInterval: number;
  };
  webhook: {
    url: string;
    secret: string;
    depositCallbackUrl: string;
    withdrawalCallbackUrl: string;
  };
  server: {
    port: number;
  };
  wallets: {
    collection: {
      address: string;
    };
    gasFee: {
      address: string;
      privateKey: string;
    };
    withdrawal: {
      address: string;
      privateKey: string;
    };
  };
  collection: {
    threshold: string; // USDT数量阈值，如 "2000000000000000000" (2 USDT)
    enabled: boolean;
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
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    database: process.env.MONGODB_DATABASE || 'spk-dev',
  },
  scanner: {
    startBlockNumber: parseInt(process.env.START_BLOCK_NUMBER || '34000000'),
    confirmationBlocks: parseInt(process.env.CONFIRMATION_BLOCKS || '6'),
    scanInterval: parseInt(process.env.SCAN_INTERVAL || '3000'),
  },
  webhook: {
    url: process.env.WEBHOOK_URL || 'http://localhost:8080/webhook/transfer',
    secret: process.env.WEBHOOK_SECRET || 'your_webhook_secret',
    depositCallbackUrl: process.env.DEPOSIT_CALLBACK_URL || 'http://localhost:8080/server/wallet/deposit/callback',
    withdrawalCallbackUrl: process.env.WITHDRAWAL_CALLBACK_URL || 'http://localhost:8080/server/wallet/transfer/callback',
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
  },
  wallets: {
    collection: {
      address: process.env.COLLECTION_WALLET_ADDRESS || '',
    },
    gasFee: {
      address: process.env.GAS_FEE_WALLET_ADDRESS || '',
      privateKey: process.env.GAS_FEE_WALLET_PRIVATE_KEY || '',
    },
    withdrawal: {
      address: process.env.WITHDRAWAL_WALLET_ADDRESS || '',
      privateKey: process.env.WITHDRAWAL_WALLET_PRIVATE_KEY || '',
    },
  },
  collection: {
    threshold: process.env.COLLECTION_THRESHOLD || '2000000000000000000', // 2 USDT
    enabled: process.env.COLLECTION_ENABLED === 'true',
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};
