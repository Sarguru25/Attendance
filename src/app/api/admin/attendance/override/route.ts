import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Leave from '@/models/Leave';
import Shift from '@/models/Shift';
import { LeaveBalanceEngine } from '@/services/LeaveBalanceEngine';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const { userId, date, status, sessions, duration = 'full_day', halfDaySession } = data; // date should be "YYYY-MM-DD"
    const finalHalfDaySession = (halfDaySession === '' || !halfDaySession) ? null : halfDaySession;

    if (!userId || !date || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await dbConnect();

    const User = (await import('@/models/User')).default;
    await import('@/models/Shift'); // Ensure Shift model is registered before population
    const user = await User.findById(userId).populate('shiftId');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse base date as UTC to prevent server timezone shifting
    const [year, month, day] = date.split('-');
    const attendanceDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0));

    let parsedLoginTime: Date | undefined;
    let parsedLogoutTime: Date | undefined;
    let totalHours = 0;
    let dbSessions: any[] = [];

    if (sessions && Array.isArray(sessions)) {
      sessions.forEach(s => {
        let checkInTime = null;
        let checkOutTime = null;
        const dateStr = attendanceDate.toISOString().split('T')[0];

        if (s.checkIn) {
          const [hours, minutes] = s.checkIn.split(':');
          checkInTime = new Date(`${dateStr}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00+05:30`);
          if (!parsedLoginTime) parsedLoginTime = checkInTime;
        }

        if (s.checkOut) {
          const [hours, minutes] = s.checkOut.split(':');
          checkOutTime = new Date(`${dateStr}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00+05:30`);
          parsedLogoutTime = checkOutTime; // Will overwrite to be the last one
        }

        if (checkInTime && checkOutTime) {
          totalHours += (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
        }

        if (checkInTime || checkOutTime) {
          dbSessions.push({
            sessionOrder: s.order,
            checkIn: checkInTime || undefined,
            checkOut: checkOutTime || undefined,
            status: (checkInTime && checkOutTime) ? 'Completed' : (checkInTime ? 'Pending' : 'Missing Checkout'),
            lateMinutes: 0
          });
        }
      });
    }

    const attendanceTypes = ['present', 'absent', 'half-day', 'late'];

    if (status === 'none' || status === 'clear') {
      // Remove existing attendance for this day
      await Attendance.findOneAndDelete({ userId, date: attendanceDate });
      
      const CompOffCredit = (await import('@/models/CompOffCredit')).default;
      await CompOffCredit.findOneAndDelete({ employeeId: userId, attendanceDate });

      // Remove existing leave and refund
      const existingLeave = await Leave.findOneAndDelete({ userId, fromDate: attendanceDate, toDate: attendanceDate });
      
      if (existingLeave) {
         // Refund balance
         const { LeaveBalanceEngine } = await import('@/services/LeaveBalanceEngine');
         await LeaveBalanceEngine.syncLeaveBalance(userId);
         const user = await User.findById(userId);
         if (user && user.leaveBalance) {
            const oldDeductAmount = existingLeave.numberOfDays || 1;
            if (existingLeave.leaveType === 'Casual Leave') {
              user.leaveBalance.casualLeave.taken -= oldDeductAmount;
              user.leaveBalance.casualLeave.available += oldDeductAmount;
            } else if (existingLeave.leaveType === 'Sick Leave') {
              user.leaveBalance.sickLeave.taken -= oldDeductAmount;
              user.leaveBalance.sickLeave.available += oldDeductAmount;
            } else if (existingLeave.leaveType === 'Restricted Holiday') {
              user.leaveBalance.restrictedLeave.taken -= oldDeductAmount;
              user.leaveBalance.restrictedLeave.available += oldDeductAmount;
            } else if (existingLeave.leaveType === 'Maternity Leave') {
              user.leaveBalance.maternityLeave.taken -= oldDeductAmount;
              user.leaveBalance.maternityLeave.available += oldDeductAmount;
            } else if (existingLeave.leaveType === 'Paternity Leave') {
              user.leaveBalance.paternityLeave.taken -= oldDeductAmount;
              user.leaveBalance.paternityLeave.available += oldDeductAmount;
            } else if (existingLeave.leaveType === 'Leave Without Pay') {
              user.leaveBalance.leaveWithoutPay.taken -= oldDeductAmount;
            } else if (existingLeave.leaveType === 'Compensatory Off') {
               const credit = await CompOffCredit.findOne({ usedAgainstLeave: existingLeave._id });
               if (credit) {
                 credit.isUsed = false;
                 credit.usedAgainstLeave = undefined;
                 await credit.save();
                 user.leaveBalance.compensatoryOff.taken -= oldDeductAmount;
                 user.leaveBalance.compensatoryOff.available += oldDeductAmount;
               }
            }
            user.markModified('leaveBalance');
            await user.save();
         }
      }

      return NextResponse.json({ message: 'Attendance record cleared successfully' });
    }

    if (!attendanceTypes.includes(status)) {
      const isHalfDay = duration === 'half_day';
      const deductAmount = isHalfDay ? 0.5 : 1;

      // It's a leave override
      const eligibility = await LeaveBalanceEngine.checkEligibility(userId, status, deductAmount);
      if (!eligibility.eligible) {
        return NextResponse.json({ error: eligibility.reason || 'Not eligible for this leave type' }, { status: 400 });
      }

      if (status === 'Restricted Holiday') {
        const Holiday = (await import('@/models/Holiday')).default;
        
        const startOfDay = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0));
        const endOfDay = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59, 999));

        const isRH = await Holiday.exists({
          date: { $gte: startOfDay, $lte: endOfDay },
          holidayType: 'restricted'
        });
        if (!isRH) {
          const dateStr = attendanceDate.toISOString().split('T')[0];
          return NextResponse.json({ error: `Cannot override to Restricted Holiday. ${dateStr} is not a designated Restricted Holiday.` }, { status: 400 });
        }
      }

      // Remove existing attendance for this day so it doesn't conflict
      await Attendance.findOneAndDelete({ userId, date: attendanceDate });
      
      const CompOffCredit = (await import('@/models/CompOffCredit')).default;
      await CompOffCredit.findOneAndDelete({ employeeId: userId, attendanceDate });

      // Create or update an approved leave record
      const existingLeave = await Leave.findOne({ userId, fromDate: attendanceDate, toDate: attendanceDate });

      const leave = await Leave.findOneAndUpdate(
        { userId, fromDate: attendanceDate, toDate: attendanceDate },
        {
          $set: {
            leaveType: status,
            numberOfDays: deductAmount,
            duration,
            halfDaySession: isHalfDay ? finalHalfDaySession : null,
            reason: 'Admin Calendar Override',
            status: 'approved'
          }
        },
        { new: true, upsert: true }
      );

      if (!existingLeave || existingLeave.leaveType !== status) {
        const { LeaveBalanceEngine } = await import('@/services/LeaveBalanceEngine');
        await LeaveBalanceEngine.syncLeaveBalance(userId);
        const user = await User.findById(userId);
        
        if (user && user.leaveBalance) {
          // Refund old leave if changing types
          if (existingLeave) {
            const oldDeductAmount = existingLeave.numberOfDays || 1;
            if (existingLeave.leaveType === 'Casual Leave') {
              user.leaveBalance.casualLeave.taken -= oldDeductAmount;
              user.leaveBalance.casualLeave.available += oldDeductAmount;
            } else if (existingLeave.leaveType === 'Sick Leave') {
              user.leaveBalance.sickLeave.taken -= oldDeductAmount;
              user.leaveBalance.sickLeave.available += oldDeductAmount;
            } else if (existingLeave.leaveType === 'Restricted Holiday') {
              user.leaveBalance.restrictedLeave.taken -= oldDeductAmount;
              user.leaveBalance.restrictedLeave.available += oldDeductAmount;
            } else if (existingLeave.leaveType === 'Maternity Leave') {
              user.leaveBalance.maternityLeave.taken -= oldDeductAmount;
              user.leaveBalance.maternityLeave.available += oldDeductAmount;
            } else if (existingLeave.leaveType === 'Paternity Leave') {
              user.leaveBalance.paternityLeave.taken -= oldDeductAmount;
              user.leaveBalance.paternityLeave.available += oldDeductAmount;
            } else if (existingLeave.leaveType === 'Leave Without Pay') {
              user.leaveBalance.leaveWithoutPay.taken -= oldDeductAmount;
            } else if (existingLeave.leaveType === 'Compensatory Off') {
              const credit = await CompOffCredit.findOne({ usedAgainstLeave: existingLeave._id });
              if (credit) {
                credit.isUsed = false;
                credit.usedAgainstLeave = undefined;
                await credit.save();
                user.leaveBalance.compensatoryOff.taken -= oldDeductAmount;
                user.leaveBalance.compensatoryOff.available += oldDeductAmount;
              }
            }
          }

          // Deduct new leave
          if (status === 'Casual Leave') {
            user.leaveBalance.casualLeave.taken += deductAmount;
            user.leaveBalance.casualLeave.available -= deductAmount;
          } else if (status === 'Sick Leave') {
            user.leaveBalance.sickLeave.taken += deductAmount;
            user.leaveBalance.sickLeave.available -= deductAmount;
          } else if (status === 'Restricted Holiday') {
            user.leaveBalance.restrictedLeave.taken += deductAmount;
            user.leaveBalance.restrictedLeave.available -= deductAmount;
          } else if (status === 'Maternity Leave') {
            user.leaveBalance.maternityLeave.taken += deductAmount;
            user.leaveBalance.maternityLeave.available -= deductAmount;
          } else if (status === 'Paternity Leave') {
            user.leaveBalance.paternityLeave.taken += deductAmount;
            user.leaveBalance.paternityLeave.available -= deductAmount;
          } else if (status === 'Leave Without Pay') {
            user.leaveBalance.leaveWithoutPay.taken += deductAmount;
          } else if (status === 'Compensatory Off') {
            const credits = await CompOffCredit.find({ employeeId: userId, isUsed: false }).sort({ earnedDate: 1 }).limit(Math.ceil(deductAmount));
            for (const credit of credits) {
              credit.isUsed = true;
              credit.usedAgainstLeave = leave._id;
              await credit.save();
            }
            if (credits.length > 0) {
              user.leaveBalance.compensatoryOff.taken += deductAmount;
              user.leaveBalance.compensatoryOff.available -= deductAmount;
            }
          }
          user.markModified('leaveBalance');
          await user.save();
        }
      }

      return NextResponse.json({ message: 'Leave overridden successfully', leave });
    } else {
      // It's an attendance override
      // Remove any 1-day leave on this day if exists to prevent conflicts
      const existingLeave = await Leave.findOneAndDelete({ userId, fromDate: attendanceDate, toDate: attendanceDate });
      
      if (existingLeave) {
         // Refund balance
         const { LeaveBalanceEngine } = await import('@/services/LeaveBalanceEngine');
         await LeaveBalanceEngine.syncLeaveBalance(userId);
         const user = await User.findById(userId);
         if (user && user.leaveBalance) {
            const oldDeductAmount = existingLeave.numberOfDays || 1;
            if (existingLeave.leaveType === 'Casual Leave') {
              user.leaveBalance.casualLeave.taken -= oldDeductAmount;
              user.leaveBalance.casualLeave.available += oldDeductAmount;
            } else if (existingLeave.leaveType === 'Sick Leave') {
              user.leaveBalance.sickLeave.taken -= oldDeductAmount;
              user.leaveBalance.sickLeave.available += oldDeductAmount;
            } else if (existingLeave.leaveType === 'Restricted Holiday') {
              user.leaveBalance.restrictedLeave.taken -= oldDeductAmount;
              user.leaveBalance.restrictedLeave.available += oldDeductAmount;
            } else if (existingLeave.leaveType === 'Maternity Leave') {
              user.leaveBalance.maternityLeave.taken -= oldDeductAmount;
              user.leaveBalance.maternityLeave.available += oldDeductAmount;
            } else if (existingLeave.leaveType === 'Paternity Leave') {
              user.leaveBalance.paternityLeave.taken -= oldDeductAmount;
              user.leaveBalance.paternityLeave.available += oldDeductAmount;
            } else if (existingLeave.leaveType === 'Leave Without Pay') {
              user.leaveBalance.leaveWithoutPay.taken -= oldDeductAmount;
            } else if (existingLeave.leaveType === 'Compensatory Off') {
               const CompOffCredit = (await import('@/models/CompOffCredit')).default;
               const credit = await CompOffCredit.findOne({ usedAgainstLeave: existingLeave._id });
               if (credit) {
                 credit.isUsed = false;
                 credit.usedAgainstLeave = undefined;
                 await credit.save();
                 user.leaveBalance.compensatoryOff.taken -= oldDeductAmount;
                 user.leaveBalance.compensatoryOff.available += oldDeductAmount;
               }
            }
            user.markModified('leaveBalance');
            await user.save();
         }
      }

      // Upsert attendance record
      const existingAttendanceObj = await Attendance.findOne({ userId, date: attendanceDate });
      const usedExtraMinutes = existingAttendanceObj ? (existingAttendanceObj.totalExtraMinutes! - existingAttendanceObj.availableExtraMinutes!) : 0;

      let scheduledMinutes = 0;
      if (user.shiftId && (user.shiftId as any).sessions) {
        (user.shiftId as any).sessions.forEach((s: any) => {
          const [startH, startM] = s.startTime.split(':').map(Number);
          const [endH, endM] = s.endTime.split(':').map(Number);
          let duration = (endH * 60 + endM) - (startH * 60 + startM);
          if (duration < 0) duration += 24 * 60;
          scheduledMinutes += duration;
        });
      }

      const workedMinutes = Math.round(totalHours * 60);
      let totalExtraMinutes = 0;
      if (scheduledMinutes > 0 && workedMinutes > scheduledMinutes) {
        totalExtraMinutes = workedMinutes - scheduledMinutes;
      }
      const availableExtraMinutes = Math.max(0, totalExtraMinutes - usedExtraMinutes);

      let finalStatus = status;
      let lateMinutes = 0;

      if (status === 'present' && sessions && sessions.length > 0 && user.shiftId && (user.shiftId as any).sessions?.length > 0) {
        const sortedSessions = [...sessions].sort((a: any, b: any) => a.order - b.order);
        const firstCheckIn = sortedSessions.find(s => s.checkIn)?.checkIn;
        
        if (firstCheckIn) {
           const [loginH, loginM] = firstCheckIn.split(':').map(Number);
           const loginMinutes = loginH * 60 + loginM;
           
           const shiftFirstSession = (user.shiftId as any).sessions.sort((a: any, b: any) => a.order - b.order)[0];
           const [startH, startM] = shiftFirstSession.startTime.split(':').map(Number);
           const graceTime = shiftFirstSession.graceTime || 0;
           const shiftStartMinutes = startH * 60 + startM;
           
           if (loginMinutes > shiftStartMinutes + graceTime) {
             finalStatus = 'late';
             lateMinutes = loginMinutes - shiftStartMinutes;
           }
        }
      }

      const attendance = await Attendance.findOneAndUpdate(
        { userId, date: attendanceDate },
        {
          $set: {
            status: finalStatus,
            loginTime: parsedLoginTime,
            logoutTime: parsedLogoutTime,
            sessions: dbSessions,
            totalHours,
            scheduledMinutes,
            workedMinutes,
            totalExtraMinutes,
            availableExtraMinutes,
            lateMinutes
          }
        },
        { new: true, upsert: true }
      );

      // Handle Comp-Off logic for manual override
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[attendanceDate.getDay()];
      const shift = user?.shiftId as any;
      const isWeeklyOff = shift && (!shift.workingDays || !shift.workingDays.includes(dayName));
      
      const Holiday = (await import('@/models/Holiday')).default;
      
      const startOfAttendanceDay = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0));
      const endOfAttendanceDay = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59, 999));

      const holiday = await Holiday.findOne({
        date: { $gte: startOfAttendanceDay, $lte: endOfAttendanceDay },
        holidayType: { $in: ['public', 'company'] }
      });
      const isHoliday = !!holiday;

      if (isHoliday && ['present', 'half-day', 'late'].includes(status)) {
        return NextResponse.json({ error: `Cannot mark attendance on a ${holiday.holidayType === 'public' ? 'Public' : 'Company'} Holiday. It is a mandatory paid leave.` }, { status: 400 });
      }

      const CompOffCredit = (await import('@/models/CompOffCredit')).default;
      if (isWeeklyOff || isHoliday) {
        if (['present', 'half-day', 'late'].includes(status)) {
          // Grant Comp-Off if not already granted
          const existingCredit = await CompOffCredit.findOne({ employeeId: userId, attendanceDate });
          if (!existingCredit) {
             const expiry = new Date(attendanceDate);
             expiry.setMonth(expiry.getMonth() + 3);
             await CompOffCredit.create({
               employeeId: userId,
               attendanceDate,
               earnedDate: new Date(),
               availableFromDate: new Date(), // Available immediately
               expiryDate: expiry,
               companyId: user.companyId,
             });
          }
        } else {
          // If changed to absent, remove Comp-Off
          await CompOffCredit.findOneAndDelete({ employeeId: userId, attendanceDate });
        }
      } else {
        // If it's a regular working day, ensure no comp-off exists just in case
        await CompOffCredit.findOneAndDelete({ employeeId: userId, attendanceDate });
      }

      return NextResponse.json({ message: 'Attendance overridden successfully', attendance });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
