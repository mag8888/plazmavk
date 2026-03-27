import mongoose, { Schema, Document } from 'mongoose';
import { PartnerProgramType } from './PartnerProfile.js';

export interface IPartnerReferral extends Document<mongoose.Types.ObjectId> {
  _id: mongoose.Types.ObjectId;
  profileId: mongoose.Types.ObjectId;
  referredId?: mongoose.Types.ObjectId;
  contact?: string;
  level: number;
  referralType: PartnerProgramType;
  createdAt: Date;
}

const PartnerReferralSchema = new Schema<IPartnerReferral>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'PartnerProfile',
      required: true,
    } as any,
    referredId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    } as any,
    contact: String,
    level: {
      type: Number,
      required: true,
    },
    referralType: {
      type: String,
      enum: Object.values(PartnerProgramType),
      default: PartnerProgramType.DIRECT,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'partnerReferrals',
  }
);

export const PartnerReferral = mongoose.model<IPartnerReferral>('PartnerReferral', PartnerReferralSchema);
