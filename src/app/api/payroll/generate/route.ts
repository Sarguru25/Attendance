import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import Payroll from '@/models/Payroll';
import { startOfMonth, endOfMonth, getDaysInMonth, isWeekend } from 'date-fns';

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

    // Calculate total working days (excluding Sundays, maybe Saturdays depending on company policy. Prompt says Mon-Sat working, Sunday holiday)
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
          presentDays++; // Late is still present for the day, but might have deductions
        }
      });

      // Calculate absent days based on total working days minus recorded days
      // If a person didn't check in at all, there might not be an attendance record.
      const recordedDays = presentDays + absentDays + halfDays;
      if (recordedDays < totalWorkingDays) {
        absentDays += (totalWorkingDays - recordedDays);
      }

      // Financial calculations
      const perDaySalary = employee.monthlySalary / totalWorkingDays;

      // Half-day deduction
      const halfDayDeduction = halfDays * (perDaySalary / 2);

      // Absent deduction
      const absentDeduction = absentDays * perDaySalary;

      // Late deduction (custom rule: every 3 late days = 1 half day, for example. Let's just do absent + half-day)

      const totalDeductions = halfDayDeduction + absentDeduction;
      const finalSalary = employee.monthlySalary - totalDeductions;

      // Delete any previous payroll record for this employee for the same month and year
      await Payroll.deleteMany({ userId: employee._id, month, year });

      // Create new payroll record
      const payroll = await Payroll.create({
        userId: employee._id,
        month,
        year,
        totalWorkingDays,
        presentDays,
        absentDays,
        halfDays,
        monthlySalary: employee.monthlySalary,
        deductions: totalDeductions,
        finalSalary: Math.max(0, finalSalary), // Ensure no negative salary
        generatedAt: new Date(),
      });

      generatedPayrolls.push(payroll);
    }

    return Response.json({ message: 'Payroll generated successfully', count: generatedPayrolls.length }, { status: 200 });

  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
