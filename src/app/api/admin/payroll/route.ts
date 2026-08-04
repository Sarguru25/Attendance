import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Payroll from '@/models/Payroll';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import Holiday from '@/models/Holiday';
import Leave from '@/models/Leave';
import { startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    await dbConnect();
    const payrolls = await Payroll.find({ month, year })
      .populate({
        path: 'userId',
        select: 'name employeeId department profileImage shiftId designation joiningDate address location bankName accountNumber ifscCode leaveBalance salaryDeductions',
        populate: {
          path: 'shiftId',
          model: 'Shift',
          select: 'shiftName workingDays'
        }
      })
      .sort({ generatedAt: -1 })
      .lean();

    return NextResponse.json({ payrolls });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { month, year } = await req.json();

    if (!month || !year) {
      return NextResponse.json({ error: 'Month and year are required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const activeCompanyId = cookieStore.get('activeCompanyId')?.value || session.user.companyId;

    await dbConnect();
    const startDate = new Date(year, month - 1, 1, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Get all active employees with their shifts
    const users = await User.find({ role: { $in: ['employee', 'intern', 'manager', 'team_head', 'department_head', 'director'] }, isActive: true }).populate('shiftId');
    console.log(`Found ${users.length} users for company ${activeCompanyId}`);

    // Get holidays
    const holidays = await Holiday.find({
      date: { $gte: startDate, $lte: endDate },
      holidayType: { $in: ['public', 'company'] }
    });

    const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });
    const totalCalendarDays = new Date(year, month, 0).getDate();

    const generatedPayrolls = [];

    for (const user of users) {
      const shift = user.shiftId as any;
      const workingDaysPattern = shift?.workingDays && shift.workingDays.length > 0 
        ? shift.workingDays 
        : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']; // Default 6 days

      let totalWorkingDays = 0;
      let weeklyOffDays = 0;
      let holidayDays = 0;

      daysInMonth.forEach(d => {
        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(d);
        const isWeeklyOff = !workingDaysPattern.includes(dayName);
        const isHoliday = holidays.some(h => isSameDay(new Date(h.date), d));

        if (isWeeklyOff) {
          weeklyOffDays++;
        } else if (isHoliday) {
          holidayDays++;
        } else {
          totalWorkingDays++;
        }
      });

      // Get attendances for this user
      const attendances = await Attendance.find({
        userId: user._id,
        date: { $gte: startDate, $lte: endDate }
      });

      // Get leaves for this user
      const leaves = await Leave.find({
        userId: user._id,
        status: 'approved',
        $or: [
          { fromDate: { $lte: endDate }, toDate: { $gte: startDate } }
        ]
      });

      let presentDays = 0;
      let halfDays = 0;
      let paidLeaveDays = 0;
      let unpaidLeaveDays = 0;
      let absentDays = 0;
      let extraWorkedDays = 0;
      let compOffsTaken = 0;

      daysInMonth.forEach(d => {
        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(d);
        const isWeeklyOff = !workingDaysPattern.includes(dayName);
        const isHoliday = holidays.some(h => isSameDay(new Date(h.date), d));
        const isWorkingDay = !isWeeklyOff && !isHoliday;

        const att = attendances.find(a => isSameDay(new Date(a.date), d));
        const leaveForDay = leaves.find(l => {
          const from = new Date(l.fromDate);
          const to = new Date(l.toDate);
          from.setHours(0,0,0,0);
          to.setHours(23,59,59,999);
          return d >= from && d <= to;
        });

        if (att) {
          if (['present', 'late', 'Work From Home', 'On Duty'].includes(att.status)) presentDays++;
          if (att.status === 'half-day') halfDays++;
        }

        if (isWorkingDay) {
          if (leaveForDay) {
            if (leaveForDay.duration === 'half_day') {
               if (leaveForDay.leaveType === 'Leave Without Pay') {
                 unpaidLeaveDays += 0.5;
               } else {
                 paidLeaveDays += 0.5;
               }
               if (leaveForDay.leaveType === 'Compensatory Off') {
                 compOffsTaken += 0.5;
               }
               if (att && att.status === 'absent') {
                  absentDays += 0.5;
               } else {
                  presentDays += 0.5;
               }
            } else {
               if (leaveForDay.leaveType === 'Leave Without Pay') {
                 unpaidLeaveDays += 1;
               } else {
                 paidLeaveDays += 1;
               }
               if (leaveForDay.leaveType === 'Compensatory Off') {
                 compOffsTaken += 1;
               }
            }
          } else {
            if (att) {
              if (att.status === 'absent') {
                absentDays++;
              } else if (att.status === 'half-day') {
                absentDays += 0.5;
              }
            } else {
              absentDays++;
            }
          }
        } else {
          // If it's a Weekly Off or Holiday and they worked
          if (att) {
            if (['present', 'late', 'Work From Home', 'On Duty'].includes(att.status)) {
              extraWorkedDays++;
            } else if (att.status === 'half-day') {
              extraWorkedDays += 0.5;
            }
          }
        }
      });

      const monthlySalary = user.monthlySalary || 0;
      const perDaySalary = monthlySalary / totalCalendarDays; 

      // Deduction = Absent Days + Unpaid Leave Days (Paid leaves do not deduct from salary)
      const deductionDays = absentDays + unpaidLeaveDays;
      let deductionAmount = deductionDays * perDaySalary;

      // Calculate extra pay for unconsumed compensatory off days worked in this month
      const payableExtraDays = Math.max(0, extraWorkedDays - compOffsTaken);
      const extraPayAmount = payableExtraDays * perDaySalary;

      const paidDays = totalCalendarDays - deductionDays + payableExtraDays;
      const leaveDays = paidLeaveDays + unpaidLeaveDays;

      // New: Salary Deductions
      let esiDeduction = 0;
      let hraDeduction = 0;
      let loanDeduction = 0;

      if (user.role !== 'intern') {

      if (monthlySalary <= 21000) {
        esiDeduction = Math.round(monthlySalary * 0.0075);
      }

      if (user.salaryDeductions?.hra?.enabled) {
        hraDeduction = user.salaryDeductions.hra.amount || 0;
      }

      if (user.salaryDeductions?.loan?.enabled && user.salaryDeductions.loan.remainingMonths > 0) {
        let isWithinDates = true;
        
        if (user.salaryDeductions.loan.startDate && user.salaryDeductions.loan.endDate) {
           const payrollYearMonth = year * 100 + month; 
           const startD = new Date(user.salaryDeductions.loan.startDate);
           const endD = new Date(user.salaryDeductions.loan.endDate);
           const startYM = startD.getFullYear() * 100 + (startD.getMonth() + 1);
           const endYM = endD.getFullYear() * 100 + (endD.getMonth() + 1);
           
           if (payrollYearMonth < startYM || payrollYearMonth > endYM) {
             isWithinDates = false;
           }
        }

        if (isWithinDates) {
          loanDeduction = user.salaryDeductions.loan.monthlyDeduction || 0;

          // Process Loan
          user.salaryDeductions.loan.remainingMonths -= 1;
          user.salaryDeductions.loan.totalPaid += loanDeduction;

          if (user.salaryDeductions.loan.remainingMonths <= 0) {
            user.salaryDeductions.loan.completed = true;
            user.salaryDeductions.loan.enabled = false;
            user.salaryDeductions.loan.remainingMonths = 0;
          }

          user.markModified('salaryDeductions');
          await user.save();
        }
      }
      } // End if (user.role !== 'intern')

      deductionAmount += esiDeduction + hraDeduction + loanDeduction;
      const grossSalary = monthlySalary + extraPayAmount;
      const netSalary = grossSalary - deductionAmount;

      // Upsert payroll
      const payroll = await Payroll.findOneAndUpdate(
        { userId: user._id, month, year, companyId: activeCompanyId },
        {
          totalCalendarDays,
          totalWorkingDays,
          presentDays,
          absentDays,
          halfDays,
          leaveDays,
          paidLeaveDays,
          unpaidLeaveDays,
          weeklyOffDays,
          holidayDays,
          paidDays,
          deductionDays,
          monthlySalary,
          grossSalary: monthlySalary,
          deductionAmount,
          netSalary,
          generatedAt: new Date(),
          companyId: activeCompanyId,
          salaryDeductionsSnapshot: {
            esi: esiDeduction,
            hra: hraDeduction,
            loan: loanDeduction
          },
          // Legacy fields for backward compatibility
          deductions: deductionAmount,
          finalSalary: netSalary
        },
        {
  upsert: true,
  returnDocument: 'after',
  bypassTenant: true
}
      ).populate('userId', 'name employeeId');

      generatedPayrolls.push(payroll);
    }

    console.log(`Successfully generated ${generatedPayrolls.length} payrolls`);
    return NextResponse.json({ message: 'Payroll generated successfully', count: generatedPayrolls.length }, { status: 201 });
  } catch (error: any) {
  console.error('PAYROLL ERROR:', error);

  return NextResponse.json(
    {
      error: error.message,
      stack: error.stack
    },
    { status: 500 }
  );
}
}
