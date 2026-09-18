import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ICompOffCredit extends Document {
  companyId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  attendanceDate: Date;
  earnedDate: Date;
  availableFromDate: Date;
  expiryDate?: Date;
  isUsed: boolean;
  credits?: number;
  usedAgainstLeave?: mongoose.Types.ObjectId;
}

const CompOffCreditSchema: Schema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: false },
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    attendanceDate: { type: Date, required: true },
    earnedDate: { type: Date, required: true },
    availableFromDate: { type: Date, required: true },
    expiryDate: { type: Date },
    isUsed: { type: Boolean, default: false },
    credits: { type: Number, default: 1 },
    usedAgainstLeave: { type: Schema.Types.ObjectId, ref: 'Leave' },
  },
  { timestamps: true }
);

CompOffCreditSchema.index({ companyId: 1 });

const CompOffCredit: Model<ICompOffCredit> = mongoose.models.CompOffCredit || mongoose.model<ICompOffCredit>('CompOffCredit', CompOffCreditSchema);
export default CompOffCredit;
