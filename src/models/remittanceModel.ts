import mongoose, { Document, Schema } from 'mongoose';

export interface IRemittance extends Document {
  institute: mongoose.Types.ObjectId;
  totalAmount: number;
  utrNumber: string;
  paymentDate: Date;
  paymentReceiptUrl: string;
  students: mongoose.Types.ObjectId[];
}

const remittanceSchema: Schema = new Schema(
  {
    institute: {
      type: Schema.Types.ObjectId,
      ref: 'Institute',
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    utrNumber: {
      type: String,
      required: true,
    },
    paymentDate: {
      type: Date,
      required: true,
    },
    paymentReceiptUrl: {
      type: String,
      required: true,
    },
    students: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Student',
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Remittance = mongoose.model<IRemittance>('Remittance', remittanceSchema);
