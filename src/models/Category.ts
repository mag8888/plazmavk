import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document<mongoose.Types.ObjectId> {
  _id: mongoose.Types.ObjectId;
  id?: string; // Virtual field
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    description: String,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'categories',
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

CategorySchema.virtual('id').get(function(this: any) {
  return this._id?.toString() || '';
});

export const Category = mongoose.model<ICategory>('Category', CategorySchema);
