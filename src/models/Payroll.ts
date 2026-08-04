import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IPayroll extends Document {
  companyId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  month: number;
  year: number;
  totalCalendarDays: number;
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  leaveDays: number;
  paidLeaveDays?: number;
  unpaidLeaveDays?: number;
  weeklyOffDays: number;
  holidayDays: number;
  paidDays: number;
  deductionDays: number;
  monthlySalary: number;
  grossSalary: number;
  deductionAmount: number;
  netSalary: number;
  // Old fields for compatibility
  deductions?: number;
  finalSalary?: number;
  payslipUrl?: string;
  generatedAt: Date;
  salaryDeductionsSnapshot?: {
    esi: number;
    hra: number;
    loan: number;
  };
}

const PayrollSchema: Schema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: false },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    totalCalendarDays: { type: Number, default: 0 },
    totalWorkingDays: { type: Number, required: true },
    presentDays: { type: Number, required: true },
    absentDays: { type: Number, required: true },
    halfDays: { type: Number, required: true },
    leaveDays: { type: Number, default: 0 },
    paidLeaveDays: { type: Number, default: 0 },
    unpaidLeaveDays: { type: Number, default: 0 },
    weeklyOffDays: { type: Number, default: 0 },
    holidayDays: { type: Number, default: 0 },
    paidDays: { type: Number, default: 0 },
    deductionDays: { type: Number, default: 0 },
    monthlySalary: { type: Number, required: true },
    grossSalary: { type: Number, default: 0 },
    deductionAmount: { type: Number, default: 0 },
    netSalary: { type: Number, default: 0 },
    // Old fields
    deductions: { type: Number },
    finalSalary: { type: Number },
    payslipUrl: { type: String },
    generatedAt: { type: Date, default: Date.now },
    salaryDeductionsSnapshot: {
      esi: { type: Number, default: 0 },
      hra: { type: Number, default: 0 },
      loan: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

// Ensure one payroll per user per company per month-year
PayrollSchema.index({ companyId: 1, userId: 1, month: 1, year: 1 }, { unique: true });

PayrollSchema.index({ companyId: 1 });

const Payroll: Model<IPayroll> = mongoose.models.Payroll || mongoose.model<IPayroll>('Payroll', PayrollSchema);
export default Payroll;
