import mongoose, { Document, Schema } from 'mongoose';

export interface IAddress extends Document {
  address: string;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema: Schema = new Schema({
  address: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true,
  },
}, {
  timestamps: true,
});

// 确保地址字段的唯一性索引
AddressSchema.index({ address: 1 }, { unique: true });

export const Address = mongoose.model<IAddress>('Address', AddressSchema);
