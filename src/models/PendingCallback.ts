import { Schema, model, Document } from 'mongoose';

export interface IPendingCallback extends Document {
  _id: string;
  type: 'withdrawal' | 'deposit'; // 回调类型
  relatedId: string; // 关联的记录ID（提现记录ID或转账记录ID）
  payload: any; // 回调负载
  url: string; // 回调URL
  transferStatus?: string; // 提现状态（仅用于提现回调）
  retryCount: number; // 重试次数
  maxRetries: number; // 最大重试次数
  nextRetryAt: Date; // 下次重试时间
  lastError?: string; // 最后一次错误信息
  status: 'pending' | 'completed' | 'failed'; // 状态
  createdAt: Date;
  updatedAt: Date;
}

const PendingCallbackSchema = new Schema<IPendingCallback>({
  type: {
    type: String,
    required: true,
    enum: ['withdrawal', 'deposit'],
  },
  relatedId: {
    type: String,
    required: true,
    index: true,
  },
  payload: {
    type: Schema.Types.Mixed,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  transferStatus: {
    type: String,
    required: false,
  },
  retryCount: {
    type: Number,
    default: 0,
  },
  maxRetries: {
    type: Number,
    default: 10, // 默认最多重试10次
  },
  nextRetryAt: {
    type: Date,
    required: true,
    index: true,
  },
  lastError: {
    type: String,
    required: false,
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
    index: true,
  },
}, {
  timestamps: true,
});

// 复合索引用于查询待重试的回调
PendingCallbackSchema.index({ 
  status: 1, 
  nextRetryAt: 1 
});

// 复合索引用于查找特定记录的回调
PendingCallbackSchema.index({ 
  type: 1, 
  relatedId: 1, 
  transferStatus: 1 
});

export const PendingCallback = model<IPendingCallback>('PendingCallback', PendingCallbackSchema);
