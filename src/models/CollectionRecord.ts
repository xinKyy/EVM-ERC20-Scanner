import mongoose, { Document, Schema } from 'mongoose';

export enum CollectionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface ICollectionRecord extends Document {
  userId: string;
  fromAddress: string;
  toAddress: string; // 归集目标地址
  amount: string; // 归集数量 (wei)
  amountFormatted: string; // 格式化的归集数量
  gasUsed: string; // 使用的gas费 (wei)
  gasFeeAddress: string; // 支付gas费的地址
  transactionHash?: string;
  blockNumber?: number;
  status: CollectionStatus;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CollectionRecordSchema: Schema = new Schema({
  userId: {
    type: String,
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
  gasFeeAddress: {
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
    enum: Object.values(CollectionStatus),
    default: CollectionStatus.PENDING,
    index: true,
  },
  errorMessage: {
    type: String,
  },
  retryCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// 复合索引
CollectionRecordSchema.index({ userId: 1, status: 1 });
CollectionRecordSchema.index({ fromAddress: 1, status: 1 });
CollectionRecordSchema.index({ status: 1, createdAt: 1 });

export const CollectionRecord = mongoose.model<ICollectionRecord>('CollectionRecord', CollectionRecordSchema);
