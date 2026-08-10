import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IPushToken extends Document {
  companyId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  token: string;
  platform: 'web' | 'android' | 'ios';
  createdAt: Date;
  updatedAt: Date;
}

const PushTokenSchema: Schema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: false },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['web', 'android', 'ios'], required: true },
  },
  { timestamps: true }
);

// Indexes for faster lookup
PushTokenSchema.index({ userId: 1 });
PushTokenSchema.index({ companyId: 1 });

const PushToken: Model<IPushToken> = mongoose.models.PushToken || mongoose.model<IPushToken>('PushToken', PushTokenSchema);
export default PushToken;
