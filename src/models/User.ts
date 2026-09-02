import mongoose, { Document, Model, Schema } from 'mongoose';
import './Shift';
import './Company';

export interface IUser extends Document {
  companyId?: mongoose.Types.ObjectId;
  companyIds: mongoose.Types.ObjectId[];
  employeeId: string;
  name: string;
  email: string;
  password?: string;
  role: 'super_admin' | 'company_admin' | 'admin' | 'director' | 'department_head' | 'manager' | 'team_head' | 'employee' | 'intern';
  department: string;
  designation: string;
  reportsTo?: mongoose.Types.ObjectId | null;
  shiftId?: mongoose.Types.ObjectId;
  profileImage?: string;
  phoneNumber?: string;
  address?: string;
  emergencyContact?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  joiningDate: Date;
  monthlySalary: number;
  salaryTimelines?: {
    _id?: mongoose.Types.ObjectId;
    effectiveFrom: Date;
    monthlySalary: number;
    createdAt?: Date;
    updatedAt?: Date;
  }[];
  gender?: 'male' | 'female' | 'other';
  isActive: boolean;
  leaveBalance?: {
    sickLeave: { total: number; available: number; taken: number; withoutCertificate: { limit: number; used: number }; withCertificate: { limit: number; used: number } };
    casualLeave: { total: number; available: number; taken: number; carryForward: number };
    compensatoryOff: { total: number; available: number; taken: number; earned: number };
    restrictedLeave: { total: number; available: number; taken: number };
    maternityLeave: { total: number; available: number; taken: number };
    paternityLeave: { total: number; available: number; taken: number };
    leaveWithoutPay: { taken: number };
  };
  salaryDeductions?: {
    esi: { enabled: boolean; amount: number; };
    hra: { enabled: boolean; amount: number; };
    loan: {
      enabled: boolean;
      principalAmount: number;
      totalMonths: number;
      monthlyDeduction: number;
      remainingMonths: number;
      totalPaid: number;
      startDate: Date | null;
      endDate: Date | null;
      completed: boolean;
    };
  };
}

const UserSchema: Schema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    companyIds: [{ type: Schema.Types.ObjectId, ref: 'Company' }],
    employeeId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['super_admin', 'company_admin', 'admin', 'director', 'department_head', 'manager', 'team_head', 'employee', 'intern'], default: 'employee' },
    department: { type: String, required: true },
    designation: { type: String, required: true },
    reportsTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    shiftId: { type: Schema.Types.ObjectId, ref: 'Shift' },
    profileImage: { type: String },
    phoneNumber: { type: String },
    address: { type: String },
    emergencyContact: { type: String },
    bankName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String },
    joiningDate: { type: Date, required: true },
    monthlySalary: { type: Number, default: 0 },
    salaryTimelines: [
      {
        effectiveFrom: { type: Date, required: true },
        monthlySalary: { type: Number, required: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      }
    ],
    gender: { type: String, enum: ['male', 'female', 'other'] },
    isActive: { type: Boolean, default: true },
    leaveBalance: {
      sickLeave: {
        total: { type: Number, default: 12 },
        available: { type: Number, default: 12 },
        taken: { type: Number, default: 0 },
        withoutCertificate: { limit: { type: Number, default: 4 }, used: { type: Number, default: 0 } },
        withCertificate: { limit: { type: Number, default: 8 }, used: { type: Number, default: 0 } }
      },
      casualLeave: {
        total: { type: Number, default: 0 },
        available: { type: Number, default: 0 },
        taken: { type: Number, default: 0 },
        carryForward: { type: Number, default: 0 }
      },
      compensatoryOff: {
        total: { type: Number, default: 0 },
        available: { type: Number, default: 0 },
        taken: { type: Number, default: 0 },
        earned: { type: Number, default: 0 }
      },
      restrictedLeave: {
        total: { type: Number, default: 2 },
        available: { type: Number, default: 2 },
        taken: { type: Number, default: 0 }
      },
      maternityLeave: {
        total: { type: Number, default: function (this: any) { return this.gender === 'female' ? 60 : 0; } },
        available: { type: Number, default: function (this: any) { return this.gender === 'female' ? 60 : 0; } },
        taken: { type: Number, default: 0 }
      },
      paternityLeave: {
        total: { type: Number, default: function (this: any) { return this.gender === 'male' ? 2 : 0; } },
        available: { type: Number, default: function (this: any) { return this.gender === 'male' ? 2 : 0; } },
        taken: { type: Number, default: 0 }
      },
      leaveWithoutPay: {
        taken: { type: Number, default: 0 }
      }
    },
    salaryDeductions: {
      esi: {
        enabled: { type: Boolean, default: false },
        amount: { type: Number, default: 0 }
      },
      hra: {
        enabled: { type: Boolean, default: false },
        amount: { type: Number, default: 0 }
      },
      loan: {
        enabled: { type: Boolean, default: false },
        principalAmount: { type: Number, default: 0 },
        totalMonths: { type: Number, default: 0 },
        monthlyDeduction: { type: Number, default: 0 },
        remainingMonths: { type: Number, default: 0 },
        totalPaid: { type: Number, default: 0 },
        startDate: { type: Date, default: null },
        endDate: { type: Date, default: null },
        completed: { type: Boolean, default: false }
      }
    }
  },
  { timestamps: true }
);

// Indexes for multi-company support
UserSchema.index({ companyId: 1 });
UserSchema.index({ companyIds: 1 });

delete mongoose.models.User;
const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
export default User;
