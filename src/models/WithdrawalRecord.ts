import mongoose, { Document, Schema } from 'mongoose';

export enum WithdrawalStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface IWithdrawalRecord extends Document {
  userId?: string; // 可选，如果是管理员操作可能没有userId
  transId?: string; // 外部交易ID，由请求者提供
  toAddress: string; // 提现目标地址
  amount: string; // 提现数量 (wei)
  amountFormatted: string; // 格式化的提现数量
  gasUsed: string; // 使用的gas费 (wei)
  withdrawalWalletAddress: string; // 提现钱包地址
  transactionHash?: string;
  blockNumber?: number;
  status: WithdrawalStatus;
  errorMessage?: string;
  retryCount: number;
  requestedBy: string; // 请求者标识
  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalRecordSchema: Schema = new Schema({
  userId: {
    type: String,
    index: true,
  },
  transId: {
    type: String,
    index: true, // 添加索引以便查询
  },
  toAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true,
  },
  amount: {
    type: String,
    required: true,
  },
  amountFormatted: {
    type: String,
    required: true,
  },
  gasUsed: {
    type: String,
    default: '0',
  },
  withdrawalWalletAddress: {
    type: String,
    required: true,
    lowercase: true,
  },
  transactionHash: {
    type: String,
    index: true,
  },
  blockNumber: {
    type: Number,
    index: true,
  },
  status: {
    type: String,
    enum: Object.values(WithdrawalStatus),
    default: WithdrawalStatus.PENDING,
    index: true,
  },
  errorMessage: {
    type: String,
  },
  retryCount: {
    type: Number,
    default: 0,
  },
  requestedBy: {
    type: String,
    required: true,
  },
}, {
  timestamps: true,
});

// 复合索引
WithdrawalRecordSchema.index({ userId: 1, status: 1 });
WithdrawalRecordSchema.index({ toAddress: 1, status: 1 });
WithdrawalRecordSchema.index({ status: 1, createdAt: 1 });

export const WithdrawalRecord = mongoose.model<IWithdrawalRecord>('WithdrawalRecord', WithdrawalRecordSchema);
