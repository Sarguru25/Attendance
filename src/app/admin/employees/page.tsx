import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Shift from '@/models/Shift';
import EmployeeClient from './EmployeeClient';
import { LeaveBalanceEngine } from '@/services/LeaveBalanceEngine';

export const dynamic = 'force-dynamic';

export default async function EmployeesPage() {
  await dbConnect();

  let shiftsDoc = await Shift.find({ isActive: true }).lean();

  if (shiftsDoc.length === 0) {
    await Shift.create([
      { shiftName: 'Shift A', startTime: '09:00', endTime: '18:00', graceTime: 15, workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
      { shiftName: 'Shift B', startTime: '07:30', endTime: '18:00', graceTime: 15, workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] }
    ]);
    shiftsDoc = await Shift.find({ isActive: true }).lean();
  }

  const employeesDoc = await User.find({ role: { $ne: 'super_admin' } }).populate('shiftId').sort({ createdAt: -1 }).lean();

  const currentYear = new Date().getFullYear();
  const employeesWithBalances = await Promise.all(employeesDoc.map(async (emp: any) => {
    try {
      const balance = await LeaveBalanceEngine.syncLeaveBalance(emp._id.toString());
      return { ...emp, leaveBalance: balance };
    } catch (e) {
      return { ...emp, leaveBalance: null };
    }
  }));

  const employees = JSON.parse(JSON.stringify(employeesWithBalances));
  const shifts = JSON.parse(JSON.stringify(shiftsDoc));

  return <EmployeeClient initialEmployees={employees} shifts={shifts} />;
}