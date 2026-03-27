import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAudioFile extends Document<mongoose.Types.ObjectId> {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  fileId: string;
  duration?: number;
  fileSize?: number;
  mimeType?: string;
  isActive: boolean;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AudioFileSchema = new Schema<IAudioFile>(
  {
    title: {
      type: String,
      required: true,
    },
    description: String,
    fileId: {
      type: String,
      required: true,
    },
    duration: Number,
    fileSize: Number,
    mimeType: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    category: String,
  },
  {
    timestamps: true,
    collection: 'audioFiles',
  }
);

export const AudioFile = mongoose.model<IAudioFile>('AudioFile', AudioFileSchema);
