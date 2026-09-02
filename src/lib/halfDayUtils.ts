import mongoose from 'mongoose';

export interface HalfSessionBoundaries {
  firstHalf: {
    start: string; // e.g. "09:00"
    end: string;   // e.g. "13:00"
  };
  secondHalf: {
    start: string; // e.g. "13:00"
    end: string;   // e.g. "18:00"
  };
}

/**
 * Calculates start and end times for firstHalf and secondHalf from shift configuration.
 */
export function calculateHalfSession(shift: any): HalfSessionBoundaries {
  if (shift?.firstHalf?.startTime && shift?.firstHalf?.endTime && shift?.secondHalf?.startTime && shift?.secondHalf?.endTime) {
    return {
      firstHalf: {
        start: shift.firstHalf.startTime,
        end: shift.firstHalf.endTime,
      },
      secondHalf: {
        start: shift.secondHalf.startTime,
        end: shift.secondHalf.endTime,
      },
    };
  }

  if (shift && Array.isArray(shift.sessions) && shift.sessions.length >= 2) {
    const sorted = [...shift.sessions].sort((a: any, b: any) => a.order - b.order);
    return {
      firstHalf: {
        start: sorted[0].startTime,
        end: sorted[0].endTime,
      },
      secondHalf: {
        start: sorted[1].startTime,
        end: sorted[1].endTime,
      },
    };
  }

  let startTime = shift?.startTime || (shift?.sessions?.[0]?.startTime) || "09:00";
  let endTime = shift?.endTime || (shift?.sessions?.[0]?.endTime) || "18:00";

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startMinutes = (isNaN(startH) ? 9 : startH) * 60 + (isNaN(startM) ? 0 : startM);
  let endMinutes = (isNaN(endH) ? 18 : endH) * 60 + (isNaN(endM) ? 0 : endM);
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  const midpointMinutes = Math.round((startMinutes + endMinutes) / 2);

  const midH = Math.floor(midpointMinutes / 60) % 24;
  const midM = midpointMinutes % 60;
  const midpointStr = `${midH.toString().padStart(2, '0')}:${midM.toString().padStart(2, '0')}`;

  return {
    firstHalf: {
      start: startTime,
      end: midpointStr,
    },
    secondHalf: {
      start: midpointStr,
      end: endTime,
    },
  };
}

/**
 * Checks whether a leave type is paid or unpaid.
 */
export function isLeaveTypePaid(leaveType: string): boolean {
  if (!leaveType) return true;
  const unpaidTypes = ['leave without pay', 'lwp', 'unpaid leave', 'unpaid'];
  return !unpaidTypes.includes(leaveType.trim().toLowerCase());
}

/**
 * Calculates daily attendance, session statuses, total worked hours, leave days, paid/unpaid impact, and late minutes.
 */
export function calculateDailyAttendance({
  shift,
  date,
  existingAttendance,
  approvedLeaves = [],
  isHoliday = false,
  isWeeklyOff = false
}: {
  shift: any;
  date: Date;
  existingAttendance?: any;
  approvedLeaves?: any[];
  isHoliday?: boolean;
  isWeeklyOff?: boolean;
}) {
  const boundaries = calculateHalfSession(shift);

  const fullDayLeave = approvedLeaves.find(l => l.duration !== 'half_day');
  const firstHalfLeave = approvedLeaves.find(l => l.duration === 'half_day' && l.halfDaySession === 'first_half');
  const secondHalfLeave = approvedLeaves.find(l => l.duration === 'half_day' && l.halfDaySession === 'second_half');

  const fhLeave = fullDayLeave || firstHalfLeave || (existingAttendance?.firstHalf?.status === 'leave' ? existingAttendance.firstHalf : null);
  const shLeave = fullDayLeave || secondHalfLeave || (existingAttendance?.secondHalf?.status === 'leave' ? existingAttendance.secondHalf : null);

  let firstHalf: any = {
    status: null,
    leaveId: null,
    leaveType: null,
    checkIn: null,
    checkOut: null,
    workedHours: 0,
    lateMinutes: 0
  };

  let secondHalf: any = {
    status: null,
    leaveId: null,
    leaveType: null,
    checkIn: null,
    checkOut: null,
    workedHours: 0,
    lateMinutes: 0
  };

  if (fhLeave) {
    firstHalf.status = 'leave';
    firstHalf.leaveId = fhLeave._id || fhLeave.leaveId;
    firstHalf.leaveType = fhLeave.leaveType;
  } else if (existingAttendance?.firstHalf) {
    firstHalf = { ...firstHalf, ...existingAttendance.firstHalf };
  }

  if (shLeave) {
    secondHalf.status = 'leave';
    secondHalf.leaveId = shLeave._id || shLeave.leaveId;
    secondHalf.leaveType = shLeave.leaveType;
  } else if (existingAttendance?.secondHalf) {
    secondHalf = { ...secondHalf, ...existingAttendance.secondHalf };
  }

  if (existingAttendance) {
    if (existingAttendance.sessions && existingAttendance.sessions.length > 0) {
      const sorted = [...existingAttendance.sessions].sort((a: any, b: any) => a.sessionOrder - b.sessionOrder);
      if (sorted[0] && !fhLeave) {
        firstHalf.checkIn = sorted[0].checkIn || firstHalf.checkIn;
        firstHalf.checkOut = sorted[0].checkOut || firstHalf.checkOut;
        if (firstHalf.checkIn && firstHalf.status !== 'leave') {
          firstHalf.status = sorted[0].lateMinutes > 0 ? 'late' : 'present';
          firstHalf.lateMinutes = sorted[0].lateMinutes || 0;
        }
      }
      if (sorted[1] && !shLeave) {
        secondHalf.checkIn = sorted[1].checkIn || secondHalf.checkIn;
        secondHalf.checkOut = sorted[1].checkOut || secondHalf.checkOut;
        if (secondHalf.checkIn && secondHalf.status !== 'leave') {
          secondHalf.status = sorted[1].lateMinutes > 0 ? 'late' : 'present';
          secondHalf.lateMinutes = sorted[1].lateMinutes || 0;
        }
      } else if (sorted.length === 1 && firstHalfLeave && !shLeave) {
        secondHalf.checkIn = sorted[0].checkIn || secondHalf.checkIn;
        secondHalf.checkOut = sorted[0].checkOut || secondHalf.checkOut;
        if (secondHalf.checkIn && secondHalf.status !== 'leave') {
          secondHalf.status = sorted[0].lateMinutes > 0 ? 'late' : 'present';
          secondHalf.lateMinutes = sorted[0].lateMinutes || 0;
        }
      }
    } else {
      if (existingAttendance.loginTime && !fhLeave) {
        firstHalf.checkIn = existingAttendance.loginTime;
        firstHalf.checkOut = existingAttendance.logoutTime;
        if (firstHalf.status !== 'leave') {
          firstHalf.status = existingAttendance.lateMinutes > 0 ? 'late' : 'present';
          firstHalf.lateMinutes = existingAttendance.lateMinutes || 0;
        }
      }
    }
  }

  if (firstHalf.checkIn && firstHalf.checkOut) {
    firstHalf.workedHours = Math.max(0, (new Date(firstHalf.checkOut).getTime() - new Date(firstHalf.checkIn).getTime()) / (1000 * 60 * 60));
  }
  if (secondHalf.checkIn && secondHalf.checkOut) {
    secondHalf.workedHours = Math.max(0, (new Date(secondHalf.checkOut).getTime() - new Date(secondHalf.checkIn).getTime()) / (1000 * 60 * 60));
  }

  if (firstHalf.status === 'leave' && secondHalf.checkIn && secondHalf.status !== 'leave') {
    const [shHours, shMins] = boundaries.secondHalf.start.split(':').map(Number);
    const checkInDate = new Date(secondHalf.checkIn);

    const istTimeStr = checkInDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
    const [cHours, cMins] = istTimeStr.split(':').map(Number);

    const checkInMins = cHours * 60 + cMins;
    const startMins = shHours * 60 + shMins;
    const graceTime = shift?.sessions?.[1]?.graceTime || shift?.sessions?.[0]?.graceTime || 0;

    if (checkInMins > startMins + graceTime) {
      secondHalf.lateMinutes = checkInMins - startMins;
      secondHalf.status = 'late';
    } else {
      secondHalf.lateMinutes = 0;
      secondHalf.status = 'present';
    }
  }

  const totalWorkedHours = (firstHalf.workedHours || 0) + (secondHalf.workedHours || 0);

  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;

  if (firstHalf.status === 'leave' && firstHalf.leaveType) {
    if (isLeaveTypePaid(firstHalf.leaveType)) {
      paidLeaveDays += 0.5;
    } else {
      unpaidLeaveDays += 0.5;
    }
  }
  if (secondHalf.status === 'leave' && secondHalf.leaveType) {
    if (isLeaveTypePaid(secondHalf.leaveType)) {
      paidLeaveDays += 0.5;
    } else {
      unpaidLeaveDays += 0.5;
    }
  }

  const totalLeaveDays = paidLeaveDays + unpaidLeaveDays;

  let finalStatus = existingAttendance?.status || 'absent';
  if (isHoliday) {
    finalStatus = 'Holiday';
  } else if (isWeeklyOff) {
    finalStatus = 'Weekly Off';
  } else if (firstHalf.status === 'leave' && secondHalf.status === 'leave') {
    finalStatus = 'Leave';
  } else if ((firstHalf.status === 'present' || firstHalf.status === 'late') && (secondHalf.status === 'present' || secondHalf.status === 'late')) {
    finalStatus = (firstHalf.status === 'late' || secondHalf.status === 'late') ? 'late' : 'present';
  } else if (firstHalf.status === 'leave' || secondHalf.status === 'leave') {
    finalStatus = 'half-day';
  } else if (firstHalf.status === 'present' || firstHalf.status === 'late' || secondHalf.status === 'present' || secondHalf.status === 'late') {
    finalStatus = 'half-day';
  }

  return {
    firstHalf,
    secondHalf,
    finalStatus,
    totalWorkedHours,
    totalLeaveDays,
    paidLeaveDays,
    unpaidLeaveDays,
    lateMinutes: (firstHalf.lateMinutes || 0) + (secondHalf.lateMinutes || 0)
  };
}

/**
 * Synchronizes approved or revoked leave with Attendance records for affected dates.
 */
export async function syncLeaveToAttendance(leave: any, isApproved: boolean) {
  if (!leave) return;
  const Attendance = (await import('@/models/Attendance')).default;
  const User = (await import('@/models/User')).default;
  const user = await User.findById(leave.userId).populate('shiftId');

  const fromStr = new Date(leave.fromDate).toISOString().split('T')[0];
  const toStr = new Date(leave.toDate).toISOString().split('T')[0];

  const [fromY, fromM, fromD] = fromStr.split('-').map(Number);
  const [toY, toM, toD] = toStr.split('-').map(Number);

  let cur = new Date(Date.UTC(fromY, fromM - 1, fromD, 0, 0, 0, 0));
  const end = new Date(Date.UTC(toY, toM - 1, toD, 23, 59, 59, 999));

  while (cur <= end) {
    const startOfDay = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate(), 23, 59, 59, 999));

    let attendance = await Attendance.findOne({
      userId: leave.userId,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (isApproved) {
      if (!attendance) {
        attendance = new Attendance({
          userId: leave.userId,
          companyId: user?.companyId,
          date: startOfDay,
          shiftId: user?.shiftId?._id || user?.shiftId,
          status: leave.duration === 'half_day' ? 'half-day' : 'Leave',
          sessions: []
        });
      }

      if (leave.duration === 'half_day') {
        const leaveSession: any = {
          status: 'leave',
          leaveId: leave._id,
          leaveType: leave.leaveType
        };

        if (leave.halfDaySession === 'first_half') {
          attendance.firstHalf = leaveSession;
          if (!attendance.secondHalf?.status || attendance.secondHalf.status === 'leave') {
            attendance.secondHalf = { status: null, workedHours: 0, lateMinutes: 0 };
          }
        } else {
          attendance.secondHalf = leaveSession;
          if (!attendance.firstHalf?.status || attendance.firstHalf.status === 'leave') {
            attendance.firstHalf = { status: null, workedHours: 0, lateMinutes: 0 };
          }
        }

        const isPaid = isLeaveTypePaid(leave.leaveType);
        if (isPaid) {
          attendance.paidLeaveDays = (attendance.paidLeaveDays || 0) + 0.5;
        } else {
          attendance.unpaidLeaveDays = (attendance.unpaidLeaveDays || 0) + 0.5;
        }

        if (attendance.firstHalf?.status === 'leave' && attendance.secondHalf?.status === 'leave') {
          attendance.status = 'Leave';
        } else {
          attendance.status = 'half-day';
        }
      } else {
        const leaveSession: any = {
          status: 'leave',
          leaveId: leave._id,
          leaveType: leave.leaveType
        };
        attendance.firstHalf = leaveSession;
        attendance.secondHalf = leaveSession;
        attendance.status = 'Leave';

        const isPaid = isLeaveTypePaid(leave.leaveType);
        if (isPaid) {
          attendance.paidLeaveDays = 1;
          attendance.unpaidLeaveDays = 0;
        } else {
          attendance.unpaidLeaveDays = 1;
          attendance.paidLeaveDays = 0;
        }
      }

      await attendance.save();
    } else {
      if (attendance) {
        if (leave.duration === 'half_day') {
          if (leave.halfDaySession === 'first_half' && attendance.firstHalf?.status === 'leave') {
            attendance.firstHalf = { status: null, leaveId: null, leaveType: null, workedHours: 0, lateMinutes: 0 };
          }
          if (leave.halfDaySession === 'second_half' && attendance.secondHalf?.status === 'leave') {
            attendance.secondHalf = { status: null, leaveId: null, leaveType: null, workedHours: 0, lateMinutes: 0 };
          }
          if (attendance.firstHalf?.status === 'present' || attendance.secondHalf?.status === 'present') {
            attendance.status = 'half-day';
          } else {
            attendance.status = 'absent';
          }
        } else {
          if (attendance.firstHalf?.status === 'leave') attendance.firstHalf = { status: null, leaveId: null, leaveType: null, workedHours: 0, lateMinutes: 0 };
          if (attendance.secondHalf?.status === 'leave') attendance.secondHalf = { status: null, leaveId: null, leaveType: null, workedHours: 0, lateMinutes: 0 };
          attendance.status = 'absent';
        }
        await attendance.save();
      }
    }

    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}
