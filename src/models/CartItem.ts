import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICartItem extends Document<mongoose.Types.ObjectId> {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  quantity: number;
  createdAt: Date;
}

const CartItemSchema = new Schema<ICartItem>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    } as any,
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    } as any,
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'cartItems',
  }
);

// Compound unique index for userId and productId
CartItemSchema.index({ userId: 1, productId: 1 }, { unique: true });

export const CartItem = mongoose.model<ICartItem>('CartItem', CartItemSchema);
