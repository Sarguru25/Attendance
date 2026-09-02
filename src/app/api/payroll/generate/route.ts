import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import Payroll from '@/models/Payroll';
import { startOfMonth, endOfMonth, getDaysInMonth, isWeekend } from 'date-fns';
import { getSalaryForPayrollPeriod } from '@/lib/salaryUtils';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { month, year, userId } = await req.json();

    if (!month || !year) {
      return Response.json({ error: 'Month and year are required' }, { status: 400 });
    }

    await dbConnect();

    // Determine target month range
    const targetDate = new Date(year, month - 1, 1);
    const startDate = startOfMonth(targetDate);
    const endDate = endOfMonth(targetDate);

    // Calculate total working days
    let totalWorkingDays = 0;
    for (let d = 1; d <= getDaysInMonth(targetDate); d++) {
      const current = new Date(year, month - 1, d);
      if (current.getDay() !== 0) { // 0 is Sunday
        totalWorkingDays++;
      }
    }

    let usersQuery: any = { role: { $in: ['employee', 'intern', 'manager', 'team_head', 'department_head'] }, isActive: true };
    if (userId) {
      usersQuery._id = userId;
    }

    const employees = await User.find(usersQuery);

    const generatedPayrolls = [];

    for (const employee of employees) {
      if (employee.joiningDate && new Date(employee.joiningDate) > endDate) {
        continue;
      }

      const salaryInfo = getSalaryForPayrollPeriod(employee, month, year);
      const monthlySalary = salaryInfo?.monthlySalary || employee.monthlySalary || 0;
      const salaryTimelineEffectiveFrom = salaryInfo?.effectiveFrom ? new Date(salaryInfo.effectiveFrom) : undefined;

      const attendances = await Attendance.find({
        userId: employee._id,
        date: { $gte: startDate, $lte: endDate },
      });

      let presentDays = 0;
      let absentDays = 0;
      let halfDays = 0;
      let lateDays = 0;

      attendances.forEach(record => {
        if (record.status === 'present') presentDays++;
        else if (record.status === 'absent') absentDays++;
        else if (record.status === 'half-day') halfDays++;
        else if (record.status === 'late') {
          lateDays++;
          presentDays++;
        }
      });

      const recordedDays = presentDays + absentDays + halfDays;
      if (recordedDays < totalWorkingDays) {
        absentDays += (totalWorkingDays - recordedDays);
      }

      const perDaySalary = monthlySalary / totalWorkingDays;
      const halfDayDeduction = halfDays * (perDaySalary / 2);
      const absentDeduction = absentDays * perDaySalary;
      const totalDeductions = halfDayDeduction + absentDeduction;
      const finalSalary = monthlySalary - totalDeductions;

      await Payroll.deleteMany({ userId: employee._id, month, year });

      const payroll = await Payroll.create({
        userId: employee._id,
        month,
        year,
        totalWorkingDays,
        presentDays,
        absentDays,
        halfDays,
        monthlySalary,
        salaryTimelineEffectiveFrom,
        deductions: totalDeductions,
        finalSalary: Math.max(0, finalSalary),
        generatedAt: new Date(),
      });

      generatedPayrolls.push(payroll);
    }

    return Response.json({ message: 'Payroll generated successfully', count: generatedPayrolls.length }, { status: 200 });

  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
