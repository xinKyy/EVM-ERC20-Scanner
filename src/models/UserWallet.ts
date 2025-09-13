import mongoose, { Document, Schema } from 'mongoose';

export interface IUserWallet extends Document {
  userId: string;
  address: string;
  encryptedPrivateKey: string; // 加密存储的私钥
  balance: string; // USDT余额 (wei格式)
  balanceFormatted: string; // 格式化的USDT余额
  totalReceived: string; // 累计收到的USDT (wei格式)
  totalReceivedFormatted: string; // 格式化的累计收到USDT
  lastCollectionAt?: Date; // 最后归集时间
  isActive: boolean; // 是否活跃
  createdAt: Date;
  updatedAt: Date;
}

const UserWalletSchema: Schema = new Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  address: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true,
  },
  encryptedPrivateKey: {
    type: String,
    required: true,
  },
  balance: {
    type: String,
    default: '0',
  },
  balanceFormatted: {
    type: String,
    default: '0.000000',
  },
  totalReceived: {
    type: String,
    default: '0',
  },
  totalReceivedFormatted: {
    type: String,
    default: '0.000000',
  },
  lastCollectionAt: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// 索引
UserWalletSchema.index({ userId: 1 }, { unique: true });
UserWalletSchema.index({ address: 1 }, { unique: true });
UserWalletSchema.index({ balance: 1 });
UserWalletSchema.index({ isActive: 1 });

export const UserWallet = mongoose.model<IUserWallet>('UserWallet', UserWalletSchema);
