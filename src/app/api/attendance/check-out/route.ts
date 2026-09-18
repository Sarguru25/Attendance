import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Leave from '@/models/Leave';
import { differenceInMinutes } from 'date-fns';
import { calculateHalfSession } from '@/lib/halfDayUtils';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const userId = session.user.id;
    const now = new Date();

    const istDateString = now.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
    const [month, day, year] = istDateString.split('/');

    const todayStart = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59, 999));

    const User = (await import('@/models/User')).default;
    const user = await User.findById(userId).populate('shiftId').lean();
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    const shift = user.shiftId as any;
    if (!shift) {
      return Response.json({ error: 'No shift assigned' }, { status: 400 });
    }

    const attendance = await Attendance.findOne({
      userId,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    if (!attendance) {
      return Response.json({ error: 'Not checked in today' }, { status: 400 });
    }

    const approvedLeave = await Leave.findOne({
      userId,
      status: 'approved',
      fromDate: { $lte: todayEnd },
      toDate: { $gte: todayStart }
    });

    const boundaries = calculateHalfSession(shift);
    const [shStartH, shStartM] = boundaries.secondHalf.start.split(':').map(Number);
    const currentIstTime = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
    const [curH, curM] = currentIstTime.split(':').map(Number);

    const curTotalMins = curH * 60 + curM;
    const shStartMins = shStartH * 60 + shStartM;

    let targetHalf: 'firstHalf' | 'secondHalf' = 'firstHalf';

    if (attendance.secondHalf?.checkIn && !attendance.secondHalf?.checkOut) {
      targetHalf = 'secondHalf';
    } else if (attendance.firstHalf?.checkIn && !attendance.firstHalf?.checkOut) {
      targetHalf = 'firstHalf';
    } else {
      return Response.json({ error: 'No active check-in found to check out from.' }, { status: 400 });
    }

    const checkInTime = attendance[targetHalf]?.checkIn;
    if (!checkInTime) {
      return Response.json({ error: 'No check-in recorded for this session.' }, { status: 400 });
    }

    // If employee checked in during first half and checks out at or after second half start time (full day work),
    // and has no approved second-half leave, auto-complete secondHalf as present as well!
    if (targetHalf === 'firstHalf' && curTotalMins >= shStartMins && !approvedLeave && attendance.secondHalf?.status !== 'leave') {
      const [fhEndH, fhEndM] = boundaries.firstHalf.end.split(':').map(Number);
      const fhEndDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${String(fhEndH).padStart(2, '0')}:${String(fhEndM).padStart(2, '0')}:00+05:30`);
      const shStartDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${String(shStartH).padStart(2, '0')}:${String(shStartM).padStart(2, '0')}:00+05:30`);

      const fhWorked = Math.max(0, (fhEndDate.getTime() - new Date(checkInTime).getTime()) / (1000 * 60 * 60));
      const shWorked = Math.max(0, (now.getTime() - shStartDate.getTime()) / (1000 * 60 * 60));

      attendance.firstHalf = {
        ...attendance.firstHalf,
        checkOut: fhEndDate,
        workedHours: parseFloat(fhWorked.toFixed(2))
      };

      attendance.secondHalf = {
        status: 'present',
        checkIn: shStartDate,
        checkOut: now,
        workedHours: parseFloat(shWorked.toFixed(2)),
        lateMinutes: 0
      };
    } else {
      const sessionWorked = Math.max(0, (now.getTime() - new Date(checkInTime).getTime()) / (1000 * 60 * 60));
      attendance[targetHalf] = {
        ...attendance[targetHalf],
        checkOut: now,
        workedHours: parseFloat(sessionWorked.toFixed(2))
      };
    }

    if (attendance.sessions && attendance.sessions.length > 0) {
      const activeSessionInArr = attendance.sessions.find(s => !s.checkOut);
      if (activeSessionInArr) {
        activeSessionInArr.checkOut = now;
        activeSessionInArr.status = activeSessionInArr.lateMinutes > 0 ? 'Late' : 'Completed';
      }
    }

    attendance.logoutTime = now;

    // Calculate total hours and worked minutes from actual login/logout or completed sessions
    let totalMinutes = 0;
    if (attendance.sessions && attendance.sessions.length > 1) {
      attendance.sessions.forEach(s => {
        if (s.checkIn && s.checkOut) {
          totalMinutes += differenceInMinutes(new Date(s.checkOut), new Date(s.checkIn));
        }
      });
    } else if (attendance.loginTime && attendance.logoutTime) {
      totalMinutes = Math.max(0, differenceInMinutes(new Date(attendance.logoutTime), new Date(attendance.loginTime)));
    } else {
      totalMinutes = Math.max(0, differenceInMinutes(now, new Date(checkInTime)));
    }

    const totalHours = parseFloat((totalMinutes / 60).toFixed(2));
    attendance.totalHours = totalHours;
    attendance.workedMinutes = totalMinutes;

    // Calculate scheduled and extra minutes
    let scheduledMinutes = 0;
    if (shift.sessions && Array.isArray(shift.sessions) && shift.sessions.length > 0) {
      shift.sessions.forEach((s: any) => {
        const [sh, sm] = s.startTime.split(':').map(Number);
        const [eh, em] = s.endTime.split(':').map(Number);
        let dur = (eh * 60 + em) - (sh * 60 + sm);
        if (dur < 0) dur += 24 * 60;
        scheduledMinutes += dur;
      });
    } else if (shift.startTime && shift.endTime) {
      const [sh, sm] = shift.startTime.split(':').map(Number);
      const [eh, em] = shift.endTime.split(':').map(Number);
      let dur = (eh * 60 + em) - (sh * 60 + sm);
      if (dur < 0) dur += 24 * 60;
      scheduledMinutes = dur;
    }
    attendance.scheduledMinutes = scheduledMinutes;

    let totalExtra = 0;
    if (scheduledMinutes > 0 && totalMinutes > scheduledMinutes) {
      totalExtra = totalMinutes - scheduledMinutes;
    }

    const shiftStartTimeStr = shift.startTime || shift.sessions?.[0]?.startTime || '09:00';
    const shiftEndTimeStr = shift.endTime || shift.sessions?.[shift.sessions.length - 1]?.endTime || '18:00';

    const [stH, stM] = shiftStartTimeStr.split(':').map(Number);
    const [etH, etM] = shiftEndTimeStr.split(':').map(Number);

    const shiftStart = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${String(stH).padStart(2, '0')}:${String(stM).padStart(2, '0')}:00+05:30`);
    const shiftEnd = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${String(etH).padStart(2, '0')}:${String(etM).padStart(2, '0')}:00+05:30`);

    let extraBefore = 0;
    let extraAfter = 0;
    if (attendance.loginTime && new Date(attendance.loginTime) < shiftStart) {
      extraBefore = Math.max(0, differenceInMinutes(shiftStart, new Date(attendance.loginTime)));
    }
    if (attendance.logoutTime && new Date(attendance.logoutTime) > shiftEnd) {
      extraAfter = Math.max(0, differenceInMinutes(new Date(attendance.logoutTime), shiftEnd));
    }

    attendance.extraBeforeShiftMinutes = extraBefore;
    attendance.extraAfterShiftMinutes = extraAfter;

    const previouslyUsed = (attendance.totalExtraMinutes || 0) - (attendance.availableExtraMinutes || 0);
    const newlyUsed = isNaN(previouslyUsed) || previouslyUsed < 0 ? 0 : previouslyUsed;
    attendance.totalExtraMinutes = totalExtra;
    attendance.availableExtraMinutes = Math.max(0, totalExtra - newlyUsed);

    if (approvedLeave || attendance.firstHalf?.status === 'leave' || attendance.secondHalf?.status === 'leave') {
      attendance.status = 'half-day';
    } else if (attendance.firstHalf?.checkOut && attendance.secondHalf?.checkOut) {
      attendance.status = (attendance.firstHalf?.status === 'late' || attendance.secondHalf?.status === 'late') ? 'late' : 'present';
    } else {
      attendance.status = 'half-day';
    }

    // Comp-off logic on full day checkout
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[now.getDay()];
    const isWeeklyOff = shift && Array.isArray(shift.workingDays) && !shift.workingDays.includes(dayName);

    const Holiday = (await import('@/models/Holiday')).default;
    const isHoliday = await Holiday.exists({
      date: { $gte: todayStart, $lte: todayEnd },
      holidayType: { $in: ['public', 'company'] }
    });

    if ((isWeeklyOff || isHoliday) && attendance.firstHalf?.checkOut && attendance.secondHalf?.checkOut) {
      const CompOffCredit = (await import('@/models/CompOffCredit')).default;
      const existingCredit = await CompOffCredit.findOne({ employeeId: userId, attendanceDate: { $gte: todayStart, $lte: todayEnd } });

      if (!existingCredit) {
        const expiry = new Date(now);
        expiry.setMonth(expiry.getMonth() + 3);

        await CompOffCredit.create({
          employeeId: userId,
          attendanceDate: now,
          earnedDate: now,
          availableFromDate: now,
          expiryDate: expiry,
          companyId: user.companyId,
        });

        const Notification = (await import('@/models/Notification')).default;
        await Notification.create({
          recipientId: userId,
          type: 'COMP_OFF_EARNED',
          message: 'You have earned 1 Compensatory Off for working on a holiday/Weekly Off.',
          link: '/employee/leaves',
          companyId: user.companyId,
        });
      }
    }

    await attendance.save();

    return Response.json({ message: 'Checked out successfully', attendance }, { status: 200 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
