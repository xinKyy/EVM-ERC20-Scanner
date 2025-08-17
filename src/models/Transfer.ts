import mongoose, { Document, Schema } from 'mongoose';

export enum TransferStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed'
}

export interface ITransfer extends Document {
  transactionHash: string;
  blockNumber: number;
  fromAddress: string;
  toAddress: string;
  amount: string; // 使用字符串存储大数，避免精度问题
  amountFormatted: string; // 格式化后的USDT数量
  status: TransferStatus;
  confirmationCount: number;
  webhookSent: boolean;
  webhookSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TransferSchema: Schema = new Schema({
  transactionHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  blockNumber: {
    type: Number,
    required: true,
    index: true,
  },
  fromAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true,
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
  status: {
    type: String,
    enum: Object.values(TransferStatus),
    default: TransferStatus.PENDING,
    index: true,
  },
  confirmationCount: {
    type: Number,
    default: 0,
  },
  webhookSent: {
    type: Boolean,
    default: false,
    index: true,
  },
  webhookSentAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// 复合索引
TransferSchema.index({ toAddress: 1, status: 1 });
TransferSchema.index({ blockNumber: 1, status: 1 });
TransferSchema.index({ webhookSent: 1, status: 1 });

export const Transfer = mongoose.model<ITransfer>('Transfer', TransferSchema);
