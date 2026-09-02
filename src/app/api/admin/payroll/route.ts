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
import { getSalaryForPayrollPeriod } from '@/lib/salaryUtils';

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
    const rawPayrolls = await Payroll.find({ month, year })
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

    // Deduplicate per user for this month/year: keep latest, delete older duplicates from DB
    const payrolls: any[] = [];
    const seenUser = new Set<string>();
    const idsToDelete: string[] = [];

    for (const p of rawPayrolls) {
      const userIdStr = (p.userId as any)?._id?.toString() || p.userId?.toString();
      if (userIdStr) {
        if (seenUser.has(userIdStr)) {
          idsToDelete.push((p as any)._id);
        } else {
          seenUser.add(userIdStr);
          payrolls.push(p);
        }
      } else {
        payrolls.push(p);
      }
    }

    if (idsToDelete.length > 0) {
      await Payroll.deleteMany({ _id: { $in: idsToDelete } });
    }

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

      let employedDaysInMonth = daysInMonth;
      let unemployedDays = 0;

      if (user.joiningDate) {
        const joinD = new Date(user.joiningDate);
        joinD.setHours(0, 0, 0, 0);
        employedDaysInMonth = daysInMonth.filter(d => {
          const checkD = new Date(d);
          checkD.setHours(0, 0, 0, 0);
          return checkD >= joinD;
        });
        unemployedDays = daysInMonth.length - employedDaysInMonth.length;
        if (unemployedDays < 0) unemployedDays = 0;
      }

      employedDaysInMonth.forEach(d => {
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

      employedDaysInMonth.forEach(d => {
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
          if (att && (att.firstHalf || att.secondHalf)) {
            // Process First Half
            if (att.firstHalf?.status === 'leave' || (leaveForDay && (leaveForDay.duration !== 'half_day' || leaveForDay.halfDaySession === 'first_half'))) {
              const lType = att.firstHalf?.leaveType || leaveForDay?.leaveType;
              const unpaidTypes = ['leave without pay', 'lwp', 'unpaid leave', 'unpaid'];
              if (lType && unpaidTypes.includes(lType.trim().toLowerCase())) {
                unpaidLeaveDays += 0.5;
              } else {
                paidLeaveDays += 0.5;
              }
              if (lType === 'Compensatory Off') compOffsTaken += 0.5;
            } else if (att.firstHalf?.status && ['present', 'late', 'Work From Home', 'On Duty'].includes(att.firstHalf.status)) {
              presentDays += 0.5;
            } else {
              absentDays += 0.5;
            }

            // Process Second Half
            if (att.secondHalf?.status === 'leave' || (leaveForDay && (leaveForDay.duration !== 'half_day' || leaveForDay.halfDaySession === 'second_half'))) {
              const lType = att.secondHalf?.leaveType || leaveForDay?.leaveType;
              const unpaidTypes = ['leave without pay', 'lwp', 'unpaid leave', 'unpaid'];
              if (lType && unpaidTypes.includes(lType.trim().toLowerCase())) {
                unpaidLeaveDays += 0.5;
              } else {
                paidLeaveDays += 0.5;
              }
              if (lType === 'Compensatory Off') compOffsTaken += 0.5;
            } else if (att.secondHalf?.status && ['present', 'late', 'Work From Home', 'On Duty'].includes(att.secondHalf.status)) {
              presentDays += 0.5;
            } else {
              absentDays += 0.5;
            }
          } else if (leaveForDay) {
            if (leaveForDay.duration === 'half_day') {
              const unpaidTypes = ['leave without pay', 'lwp', 'unpaid leave', 'unpaid'];
              if (unpaidTypes.includes((leaveForDay.leaveType || '').trim().toLowerCase())) {
                unpaidLeaveDays += 0.5;
              } else {
                paidLeaveDays += 0.5;
              }
              if (leaveForDay.leaveType === 'Compensatory Off') compOffsTaken += 0.5;

              if (att && ['present', 'late'].includes(att.status)) {
                presentDays += 0.5;
              } else {
                absentDays += 0.5;
              }
            } else {
              const unpaidTypes = ['leave without pay', 'lwp', 'unpaid leave', 'unpaid'];
              if (unpaidTypes.includes((leaveForDay.leaveType || '').trim().toLowerCase())) {
                unpaidLeaveDays += 1;
              } else {
                paidLeaveDays += 1;
              }
              if (leaveForDay.leaveType === 'Compensatory Off') compOffsTaken += 1;
            }
          } else {
            if (att) {
              if (['present', 'late', 'Work From Home', 'On Duty'].includes(att.status)) {
                presentDays += 1;
              } else if (att.status === 'half-day') {
                presentDays += 0.5;
                absentDays += 0.5;
              } else {
                absentDays += 1;
              }
            } else {
              absentDays += 1;
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

      // Skip employees who joined after this payroll period ended
      if (user.joiningDate && new Date(user.joiningDate) > endDate) {
        continue;
      }

      const salaryInfo = getSalaryForPayrollPeriod(user, month, year);
      const monthlySalary = salaryInfo?.monthlySalary || user.monthlySalary || 0;
      const salaryTimelineEffectiveFrom = salaryInfo?.effectiveFrom ? new Date(salaryInfo.effectiveFrom) : undefined;
      const perDaySalary = totalCalendarDays > 0 ? monthlySalary / totalCalendarDays : 0; 

      // Deduction = Unemployed Days + Absent Days + Unpaid Leave Days (Paid leaves do not deduct from salary)
      const deductionDays = unemployedDays + absentDays + unpaidLeaveDays;
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

      // ESI: Applies when salary <= 21000 and ESI toggle is enabled
      if (monthlySalary <= 21000 && user.salaryDeductions?.esi?.enabled) {
        esiDeduction = user.salaryDeductions.esi.amount || Math.round(monthlySalary * 0.0075);
      }

      // Rental / HRA Deduction (Applies to all including interns)
      if (user.salaryDeductions?.hra?.enabled) {
        hraDeduction = user.salaryDeductions.hra.amount || 0;
      }

      // Company Loan Deduction (Applies to all including interns)
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

      deductionAmount += esiDeduction + hraDeduction + loanDeduction;
      const grossSalary = monthlySalary + extraPayAmount;
      const netSalary = grossSalary - deductionAmount;

      // Delete any previous payroll for this user for the same month & year to ensure no duplicate records exist
      await Payroll.deleteMany({ userId: user._id, month, year });

      // Create new payroll record
      const payrollDoc = await Payroll.create({
        userId: user._id,
        companyId: activeCompanyId,
        month,
        year,
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
        salaryTimelineEffectiveFrom,
        grossSalary: monthlySalary,
        deductionAmount,
        netSalary,
        generatedAt: new Date(),
        salaryDeductionsSnapshot: {
          esi: esiDeduction,
          hra: hraDeduction,
          loan: loanDeduction
        },
        // Legacy fields for backward compatibility
        deductions: deductionAmount,
        finalSalary: netSalary
      });

      const payroll = await Payroll.findById(payrollDoc._id).populate('userId', 'name employeeId');

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

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null;

    if (!id && (!month || !year)) {
      return NextResponse.json({ error: 'Must provide either payroll id or month and year' }, { status: 400 });
    }

    await dbConnect();

    let query: any = {};
    if (id) {
      query._id = id;
    } else {
      query.month = month;
      query.year = year;
    }

    const payrollsToDelete = await Payroll.find(query);
    if (payrollsToDelete.length === 0) {
      return NextResponse.json({ message: 'No payroll records found to delete', count: 0 }, { status: 200 });
    }

    // Revert loan deductions if loan was deducted in any of these payrolls
    for (const p of payrollsToDelete) {
      const loanPaid = p.salaryDeductionsSnapshot?.loan || 0;
      if (loanPaid > 0 && p.userId) {
        const user = await User.findById(p.userId);
        if (user && user.salaryDeductions?.loan) {
          user.salaryDeductions.loan.remainingMonths += 1;
          user.salaryDeductions.loan.totalPaid = Math.max(0, (user.salaryDeductions.loan.totalPaid || 0) - loanPaid);
          user.salaryDeductions.loan.completed = false;
          if (user.salaryDeductions.loan.totalMonths > 0) {
            user.salaryDeductions.loan.enabled = true;
          }
          user.markModified('salaryDeductions');
          await user.save();
        }
      }
    }

    const deleteResult = await Payroll.deleteMany(query);

    return NextResponse.json({
      message: 'Payroll records deleted successfully',
      count: deleteResult.deletedCount
    }, { status: 200 });
  } catch (error: any) {
    console.error('DELETE PAYROLL ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
