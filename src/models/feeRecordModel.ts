import mongoose, { Document, Schema } from 'mongoose';

export interface IFeeRecord extends Document {
  student: mongoose.Types.ObjectId;
  amount: number;
  paymentMode: string;
  utrNumber: string;
  paymentReceiptUrl: string;
  paymentDate: Date;
  paymentPurpose: string;
}

const feeRecordSchema: Schema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentMode: {
      type: String,
      required: true,
    },
    utrNumber: {
      type: String,
      required: true,
    },
    paymentReceiptUrl: {
      type: String,
      required: true,
    },
    paymentDate: {
      type: Date,
      required: true,
    },
    paymentPurpose: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const FeeRecord = mongoose.model<IFeeRecord>('FeeRecord', feeRecordSchema);
