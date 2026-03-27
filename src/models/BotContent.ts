import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBotContent extends Document<mongoose.Types.ObjectId> {
  _id: mongoose.Types.ObjectId;
  key: string;
  title: string;
  content: string;
  description?: string;
  category?: string;
  isActive: boolean;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

const BotContentSchema = new Schema<IBotContent>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    description: String,
    category: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    language: {
      type: String,
      default: 'ru',
    },
  },
  {
    timestamps: true,
    collection: 'botContents',
  }
);

export const BotContent = mongoose.model<IBotContent>('BotContent', BotContentSchema);
