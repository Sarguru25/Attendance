import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import AttendanceCorrection from '@/models/AttendanceCorrection';
import MissPunch from '@/models/MissPunch';
import User from '@/models/User';
import Shift from '@/models/Shift';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    await dbConnect();

    let query: any = { userId: session.user.id };

    let requestQuery: any = { employeeId: session.user.id };
    
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      query.date = { $gte: startDate, $lte: endDate };
      requestQuery.date = { $gte: startDate, $lte: endDate };
    }

    const attendances = await Attendance.find(query, null, { bypassTenant: true }).sort({ date: -1 }).lean();

    const corrections = await AttendanceCorrection.find(requestQuery, null, { bypassTenant: true }).sort({ createdAt: -1 }).lean();
    const missPunches = await MissPunch.find(requestQuery, null, { bypassTenant: true }).sort({ createdAt: -1 }).lean();

    const Leave = (await import('@/models/Leave')).default;
    const leaveQuery: any = {
      userId: session.user.id,
      status: 'approved'
    };
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      leaveQuery.fromDate = { $lte: endDate };
      leaveQuery.toDate = { $gte: startDate };
    }
    const approvedLeaves = await Leave.find(leaveQuery, null, { bypassTenant: true }).lean();

    const attendancesWithStatus = attendances.map((att: any) => {
      const correction = corrections.find((c: any) => c.attendanceId?.toString() === att._id.toString());
      const missPunch = missPunches.find((m: any) => {
        if (!m.date || !att.date) return false;
        return new Date(m.date).toISOString().split('T')[0] === new Date(att.date).toISOString().split('T')[0];
      });

      const request = correction || missPunch;

      return {
        ...att,
        correctionStatus: request ? request.status : null,
        correctionType: request ? (correction ? 'Attendance Correction' : 'Miss Punch') : null
      };
    });

    // Sync approved leaves to attendancesWithStatus
    attendancesWithStatus.forEach((att: any) => {
      if (!att.date) return;
      const attD = new Date(att.date);
      attD.setHours(0, 0, 0, 0);

      const dayLeaves = approvedLeaves.filter((l: any) => {
        const from = new Date(l.fromDate);
        const to = new Date(l.toDate);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        return attD >= from && attD <= to;
      });

      if (dayLeaves.length > 0) {
        const fullDayLeave = dayLeaves.find((l: any) => l.duration !== 'half_day');
        const firstHalfLeave = dayLeaves.find((l: any) => l.duration === 'half_day' && l.halfDaySession === 'first_half');
        const secondHalfLeave = dayLeaves.find((l: any) => l.duration === 'half_day' && l.halfDaySession === 'second_half');

        if (fullDayLeave) {
          if (!att.status || att.status === 'absent' || att.status === 'Leave') {
            att.status = fullDayLeave.leaveType || 'Leave';
          }
          if (!att.firstHalf || !att.firstHalf.status) {
            att.firstHalf = { status: 'leave', leaveType: fullDayLeave.leaveType, leaveId: fullDayLeave._id };
          }
          if (!att.secondHalf || !att.secondHalf.status) {
            att.secondHalf = { status: 'leave', leaveType: fullDayLeave.leaveType, leaveId: fullDayLeave._id };
          }
        } else if (firstHalfLeave && secondHalfLeave) {
          if (!att.status || att.status === 'absent' || att.status === 'half-day' || att.status === 'Leave') {
            att.status = (firstHalfLeave.leaveType === secondHalfLeave.leaveType) ? firstHalfLeave.leaveType : 'Leave';
          }
          att.firstHalf = { ...(att.firstHalf || {}), status: 'leave', leaveType: firstHalfLeave.leaveType, leaveId: firstHalfLeave._id };
          att.secondHalf = { ...(att.secondHalf || {}), status: 'leave', leaveType: secondHalfLeave.leaveType, leaveId: secondHalfLeave._id };
        } else if (firstHalfLeave) {
          if (!att.status || att.status === 'absent') {
            att.status = 'half-day';
          }
          att.firstHalf = { ...(att.firstHalf || {}), status: 'leave', leaveType: firstHalfLeave.leaveType, leaveId: firstHalfLeave._id };
        } else if (secondHalfLeave) {
          if (!att.status || att.status === 'absent') {
            att.status = 'half-day';
          }
          att.secondHalf = { ...(att.secondHalf || {}), status: 'leave', leaveType: secondHalfLeave.leaveType, leaveId: secondHalfLeave._id };
        }
      }
    });

    // Inject missing days that have approved leaves but no attendance record yet
    approvedLeaves.forEach((leave: any) => {
      const from = new Date(leave.fromDate);
      const to = new Date(leave.toDate);
      const startDate = month && year ? new Date(parseInt(year), parseInt(month) - 1, 1) : from;
      const endDate = month && year ? new Date(parseInt(year), parseInt(month), 0, 23, 59, 59) : to;
      const loopStart = from < startDate ? startDate : from;
      const loopEnd = to > endDate ? endDate : to;

      for (let d = new Date(loopStart); d <= loopEnd; d.setDate(d.getDate() + 1)) {
        const dStr = d.toISOString().split('T')[0];
        let existing = attendancesWithStatus.find((a: any) => a.date && new Date(a.date).toISOString().split('T')[0] === dStr);
        if (!existing) {
          const isHalf = leave.duration === 'half_day';
          const newAtt = {
            _id: `${leave._id}_${dStr}`,
            date: new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)),
            status: isHalf ? 'half-day' : (leave.leaveType || 'Leave'),
            firstHalf: (!isHalf || leave.halfDaySession === 'first_half') ? {
              status: 'leave',
              leaveType: leave.leaveType,
              leaveId: leave._id
            } : { status: null },
            secondHalf: (!isHalf || leave.halfDaySession === 'second_half') ? {
              status: 'leave',
              leaveType: leave.leaveType,
              leaveId: leave._id
            } : { status: null },
            loginTime: null,
            logoutTime: null,
            totalHours: null,
            totalExtraMinutes: 0,
            availableExtraMinutes: 0,
            correctionStatus: null,
            correctionType: null
          };
          attendancesWithStatus.push(newAtt);
        } else {
          if (leave.duration === 'half_day') {
            if (leave.halfDaySession === 'first_half') {
              existing.firstHalf = { status: 'leave', leaveType: leave.leaveType, leaveId: leave._id };
            } else if (leave.halfDaySession === 'second_half') {
              existing.secondHalf = { status: 'leave', leaveType: leave.leaveType, leaveId: leave._id };
            }
            if (existing.firstHalf?.status === 'leave' && existing.secondHalf?.status === 'leave') {
              existing.status = (existing.firstHalf.leaveType === existing.secondHalf.leaveType) ? existing.firstHalf.leaveType : 'Leave';
            }
          }
        }
      }
    });

    missPunches.forEach((m: any) => {
      if (!m.date) return;
      const mDateStr = new Date(m.date).toISOString().split('T')[0];
      const match = attendances.find((att: any) => att.date && new Date(att.date).toISOString().split('T')[0] === mDateStr);
      if (!match) {
        attendancesWithStatus.push({
          _id: m._id,
          date: m.date,
          status: 'absent',
          loginTime: m.requestedCheckIn || null,
          logoutTime: m.requestedCheckOut || null,
          totalHours: null,
          correctionStatus: m.status,
          correctionType: 'Miss Punch'
        });
      }
    });

    attendancesWithStatus.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const user = await User.findById(session.user.id, null, { bypassTenant: true }).populate({ path: 'shiftId', options: { bypassTenant: true } }).lean();

    return NextResponse.json({ attendances: attendancesWithStatus, user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
