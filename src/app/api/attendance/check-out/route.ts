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
    const [shHours, shMins] = boundaries.secondHalf.start.split(':').map(Number);
    const currentIstTime = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
    const [curH, curM] = currentIstTime.split(':').map(Number);

    const curTotalMins = curH * 60 + curM;
    const shStartMins = shHours * 60 + shMins;

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

    const workedHours = Math.max(0, (now.getTime() - new Date(checkInTime).getTime()) / (1000 * 60 * 60));

    attendance[targetHalf] = {
      ...attendance[targetHalf],
      checkOut: now,
      workedHours: parseFloat(workedHours.toFixed(2))
    };

    // If employee checked in during first half and checks out at or after second half start time (full day work),
    // and has no approved second-half leave, auto-complete secondHalf as present as well!
    if (targetHalf === 'firstHalf' && curTotalMins >= shStartMins && !approvedLeave && attendance.secondHalf?.status !== 'leave') {
      attendance.secondHalf = {
        status: 'present',
        checkIn: checkInTime,
        checkOut: now,
        workedHours: parseFloat(workedHours.toFixed(2))
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

    const fhHours = attendance.firstHalf?.workedHours || 0;
    const shHours = attendance.secondHalf?.workedHours || 0;
    const totalHours = parseFloat((fhHours + shHours).toFixed(2));
    attendance.totalHours = totalHours;

    if (approvedLeave || attendance.firstHalf?.status === 'leave' || attendance.secondHalf?.status === 'leave') {
      attendance.status = 'half-day';
    } else if (attendance.firstHalf?.checkOut && attendance.secondHalf?.checkOut) {
      attendance.status = (attendance.firstHalf?.status === 'late' || attendance.secondHalf?.status === 'late') ? 'late' : 'present';
    } else {
      attendance.status = 'half-day';
    }

    await attendance.save();

    return Response.json({ message: 'Checked out successfully', attendance }, { status: 200 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
