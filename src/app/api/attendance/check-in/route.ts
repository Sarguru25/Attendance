import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import User from '@/models/User';
import Leave from '@/models/Leave';
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

    const user = await User.findById(userId).populate('shiftId').lean();
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const shift = user.shiftId as any;
    if (!shift) {
      return Response.json({ error: 'No shift assigned' }, { status: 400 });
    }

    // Check for approved leave today
    const approvedLeave = await Leave.findOne({
      userId,
      status: 'approved',
      fromDate: { $lte: todayEnd },
      toDate: { $gte: todayStart }
    });

    if (approvedLeave && approvedLeave.duration !== 'half_day') {
      return Response.json({ error: 'You are on an approved full-day leave today.' }, { status: 400 });
    }

    let existingAttendance = await Attendance.findOne({
      userId,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    if (!existingAttendance) {
      existingAttendance = await Attendance.create({
        userId,
        date: todayStart,
        shiftId: shift._id,
        status: approvedLeave ? 'half-day' : 'present',
        sessions: [],
        companyId: session.user.companyId,
      });
    }

    const boundaries = calculateHalfSession(shift);

    let isFirstHalfLeave = approvedLeave?.duration === 'half_day' && approvedLeave?.halfDaySession === 'first_half';
    let isSecondHalfLeave = approvedLeave?.duration === 'half_day' && approvedLeave?.halfDaySession === 'second_half';

    if (existingAttendance.firstHalf?.checkIn && !existingAttendance.firstHalf?.checkOut && !isFirstHalfLeave) {
      return Response.json({ error: 'You are already checked in for the First Half. Please check out first.' }, { status: 400 });
    }
    if (existingAttendance.secondHalf?.checkIn && !existingAttendance.secondHalf?.checkOut) {
      return Response.json({ error: 'You are already checked in for the Second Half.' }, { status: 400 });
    }

    let targetHalf: 'firstHalf' | 'secondHalf' = 'firstHalf';
    let expectedStartTimeStr = boundaries.firstHalf.start;

    if (isFirstHalfLeave) {
      targetHalf = 'secondHalf';
      expectedStartTimeStr = boundaries.secondHalf.start;
    } else if (existingAttendance.firstHalf?.checkIn && existingAttendance.firstHalf?.checkOut) {
      targetHalf = 'secondHalf';
      expectedStartTimeStr = boundaries.secondHalf.start;
    } else if (isSecondHalfLeave) {
      targetHalf = 'firstHalf';
      expectedStartTimeStr = boundaries.firstHalf.start;
    }

    const [startH, startM] = expectedStartTimeStr.split(':').map(Number);
    const currentIstTime = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
    const [curH, curM] = currentIstTime.split(':').map(Number);

    const curMins = curH * 60 + curM;
    const expectedMins = startH * 60 + startM;
    const graceTime = (shift.sessions && shift.sessions[targetHalf === 'secondHalf' ? 1 : 0]?.graceTime) || shift.sessions?.[0]?.graceTime || 0;

    let lateMinutes = 0;
    if (curMins > expectedMins + graceTime) {
      lateMinutes = curMins - expectedMins;
    }

    const sessionOrder = targetHalf === 'firstHalf' ? 1 : 2;

    if (targetHalf === 'firstHalf') {
      existingAttendance.firstHalf = {
        status: lateMinutes > 0 ? 'late' : 'present',
        checkIn: now,
        lateMinutes
      };
      if (isSecondHalfLeave && approvedLeave) {
        existingAttendance.secondHalf = {
          status: 'leave',
          leaveId: approvedLeave._id,
          leaveType: approvedLeave.leaveType
        };
      }
    } else {
      existingAttendance.secondHalf = {
        status: lateMinutes > 0 ? 'late' : 'present',
        checkIn: now,
        lateMinutes
      };
      if (isFirstHalfLeave && approvedLeave) {
        existingAttendance.firstHalf = {
          status: 'leave',
          leaveId: approvedLeave._id,
          leaveType: approvedLeave.leaveType
        };
      }
    }

    existingAttendance.sessions.push({
      sessionOrder,
      checkIn: now,
      lateMinutes,
      status: 'Pending'
    });

    if (existingAttendance.sessions.length === 1) {
      existingAttendance.loginTime = now;
      existingAttendance.lateMinutes = lateMinutes;
    }

    if (approvedLeave) {
      existingAttendance.status = 'half-day';
    } else if (existingAttendance.firstHalf?.status === 'late' || existingAttendance.secondHalf?.status === 'late') {
      existingAttendance.status = 'late';
    } else {
      existingAttendance.status = 'present';
    }

    await existingAttendance.save();

    if (lateMinutes > 0) {
      const Notification = (await import('@/models/Notification')).default;
      await Notification.create({
        targetRole: 'admin',
        type: 'LATE_CHECKIN',
        message: `${user.name} checked in late by ${lateMinutes} minutes for ${targetHalf === 'firstHalf' ? 'First Half' : 'Second Half'}.`,
        link: '/admin/attendance',
        companyId: session.user.companyId,
      });
    }

    return Response.json({ message: 'Checked in successfully', attendance: existingAttendance }, { status: 201 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
