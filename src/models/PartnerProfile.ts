import mongoose, { Schema, Document } from 'mongoose';

export enum PartnerProgramType {
  DIRECT = 'DIRECT',
  MULTI_LEVEL = 'MULTI_LEVEL',
}

export interface IPartnerProfile extends Document<mongoose.Types.ObjectId> {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  isActive: boolean;
  activatedAt?: Date;
  expiresAt?: Date;
  activationType?: string; // 'PURCHASE' или 'ADMIN'
  programType: PartnerProgramType;
  referralCode: string;
  balance: number;
  bonus: number;
  totalPartners: number;
  directPartners: number;
  multiPartners: number;
  createdAt: Date;
  updatedAt: Date;
}

const PartnerProfileSchema = new Schema<IPartnerProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    } as any,
    isActive: {
      type: Boolean,
      default: false,
    },
    activatedAt: Date,
    expiresAt: Date,
    activationType: String,
    programType: {
      type: String,
      enum: Object.values(PartnerProgramType),
      default: PartnerProgramType.DIRECT,
    },
    referralCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
    bonus: {
      type: Number,
      default: 0,
    },
    totalPartners: {
      type: Number,
      default: 0,
    },
    directPartners: {
      type: Number,
      default: 0,
    },
    multiPartners: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'partnerProfiles',
  }
);

export const PartnerProfile = mongoose.model<IPartnerProfile>('PartnerProfile', PartnerProfileSchema);
