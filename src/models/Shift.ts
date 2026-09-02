import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IShiftSession {
  order: number;
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "13:00"
  graceTime: number; // in minutes
}

export interface IHalfDayTiming {
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "13:30"
}

export interface IShift extends Document {
  companyId: mongoose.Types.ObjectId;
  shiftName: string;
  workingDays: string[];
  isActive: boolean;
  sessions: IShiftSession[];
  firstHalf?: IHalfDayTiming;
  secondHalf?: IHalfDayTiming;
  // Legacy fields for backward compatibility during transition
  startTime?: string;
  endTime?: string;
  graceTime?: number;
}

const SessionSchema = new Schema({
  order: { type: Number, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  graceTime: { type: Number, default: 0 }
}, { _id: false });

const HalfDayTimingSchema = new Schema({
  startTime: { type: String, required: false },
  endTime: { type: String, required: false }
}, { _id: false });

const ShiftSchema: Schema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: false },
    shiftName: { type: String, required: true },
    workingDays: [{ type: String }],
    isActive: { type: Boolean, default: true },
    sessions: { type: [SessionSchema], default: [] },
    firstHalf: { type: HalfDayTimingSchema, required: false },
    secondHalf: { type: HalfDayTimingSchema, required: false },
    // Legacy fields
    startTime: { type: String },
    endTime: { type: String },
    graceTime: { type: Number },
  },
  { timestamps: true }
);

ShiftSchema.index({ companyId: 1, shiftName: 1 }, { unique: true });

const Shift: Model<IShift> = mongoose.models.Shift || mongoose.model<IShift>('Shift', ShiftSchema);
export default Shift;
