import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderRequest extends Document<mongoose.Types.ObjectId> {
  _id: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  contact?: string;
  message: string;
  itemsJson: any;
  status: string;
  createdAt: Date;
}

const OrderRequestSchema = new Schema<IOrderRequest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    } as any,
    contact: String,
    message: {
      type: String,
      required: true,
    },
    itemsJson: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      default: 'NEW',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'orderRequests',
  }
);

export const OrderRequest = mongoose.model<IOrderRequest>('OrderRequest', OrderRequestSchema);
