import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document<mongoose.Types.ObjectId> {
  _id: mongoose.Types.ObjectId;
  id?: string; // Virtual field
  title: string;
  summary: string;
  description?: string;
  instruction?: string;
  imageUrl?: string;
  price: number;
  stock: number;
  isActive: boolean;
  availableInRussia: boolean;
  availableInBali: boolean;
  categoryId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    title: {
      type: String,
      required: true,
    },
    summary: {
      type: String,
      required: true,
    },
    description: String,
    instruction: String,
    imageUrl: String,
    price: {
      type: Number,
      required: true,
    },
    stock: {
      type: Number,
      default: 999,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    availableInRussia: {
      type: Boolean,
      default: true,
    },
    availableInBali: {
      type: Boolean,
      default: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    } as any,
  },
  {
    timestamps: true,
    collection: 'products',
    toJSON: {
      virtuals: true,
      transform: function(doc: any, ret: any) {
        if (ret._id) {
          ret.id = ret._id.toString();
          ret._id = undefined;
        }
        if (ret.__v !== undefined) {
          ret.__v = undefined;
        }
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: function(doc: any, ret: any) {
        if (ret._id) {
          ret.id = ret._id.toString();
          ret._id = undefined;
        }
        if (ret.__v !== undefined) {
          ret.__v = undefined;
        }
        return ret;
      }
    }
  }
);

ProductSchema.virtual('id').get(function(this: any) {
  return this._id?.toString() || '';
});

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
