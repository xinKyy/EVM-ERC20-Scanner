import mongoose, { Document, Schema } from 'mongoose';

export interface IScanState extends Document {
  lastScannedBlock: number;
  lastScanTime: Date;
  isScanning: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ScanStateSchema: Schema = new Schema({
  lastScannedBlock: {
    type: Number,
    required: true,
    default: 0,
  },
  lastScanTime: {
    type: Date,
    default: Date.now,
  },
  isScanning: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

export const ScanState = mongoose.model<IScanState>('ScanState', ScanStateSchema);
