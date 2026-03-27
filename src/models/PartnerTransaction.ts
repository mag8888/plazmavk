import mongoose, { Schema, Document } from 'mongoose';

export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

// Re-export for convenience
export { TransactionType as PartnerTransactionType };

export interface IPartnerTransaction extends Document<mongoose.Types.ObjectId> {
  _id: mongoose.Types.ObjectId;
  profileId: mongoose.Types.ObjectId;
  amount: number;
  type: TransactionType;
  description: string;
  createdAt: Date;
}

const PartnerTransactionSchema = new Schema<IPartnerTransaction>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'PartnerProfile',
      required: true,
    } as any,
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'partnerTransactions',
  }
);

PartnerTransactionSchema.index({ profileId: 1, createdAt: -1 });

export const PartnerTransaction = mongoose.model<IPartnerTransaction>('PartnerTransaction', PartnerTransactionSchema);
