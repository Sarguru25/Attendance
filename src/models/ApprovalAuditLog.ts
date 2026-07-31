import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IApprovalAuditLog extends Document {
  companyId: mongoose.Types.ObjectId;
  requestId: mongoose.Types.ObjectId;
  requestType: 'LEAVE' | 'MISS_PUNCH' | 'ATTENDANCE_CORRECTION' | 'WFH' | 'OVERTIME' | 'PERMISSION';
  action: 'approved' | 'rejected';
  performedBy: mongoose.Types.ObjectId;
  performedAt: Date;
  oldValue?: string;
  newValue?: string;
}

const ApprovalAuditLogSchema: Schema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: false },
    requestId: { type: Schema.Types.ObjectId, required: true },
    requestType: { type: String, enum: ['LEAVE', 'MISS_PUNCH', 'ATTENDANCE_CORRECTION', 'WFH', 'OVERTIME', 'PERMISSION'], required: true },
    action: { type: String, enum: ['approved', 'rejected'], required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    performedAt: { type: Date, default: Date.now },
    oldValue: { type: String },
    newValue: { type: String },
  },
  { timestamps: true }
);

ApprovalAuditLogSchema.index({ companyId: 1 });

const ApprovalAuditLog: Model<IApprovalAuditLog> = mongoose.models.ApprovalAuditLog || mongoose.model<IApprovalAuditLog>('ApprovalAuditLog', ApprovalAuditLogSchema);
export default ApprovalAuditLog;
