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
  approvedPermissions = [],
  isHoliday = false,
  isWeeklyOff = false
}: {
  shift: any;
  date: Date;
  existingAttendance?: any;
  approvedLeaves?: any[];
  approvedPermissions?: any[];
  isHoliday?: boolean;
  isWeeklyOff?: boolean;
}) {
  const boundaries = calculateHalfSession(shift);
  const { mergePermissionIntervals, calculateEffectiveExpectedCheckIn } = require('./attendanceUtils');
  const { totalPermissionMinutes, primaryStart, primaryEnd } = mergePermissionIntervals(approvedPermissions);
  const { effectiveCheckInStart, effectiveCheckInMinutes } = calculateEffectiveExpectedCheckIn({
    shiftStart: boundaries.firstHalf.start,
    permissions: approvedPermissions
  });

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
      } else if (sorted.length === 1 && !shLeave) {
        if (firstHalfLeave) {
          secondHalf.checkIn = sorted[0].checkIn || secondHalf.checkIn;
          secondHalf.checkOut = sorted[0].checkOut || secondHalf.checkOut;
          if (secondHalf.checkIn && secondHalf.status !== 'leave') {
            secondHalf.status = sorted[0].lateMinutes > 0 ? 'late' : 'present';
            secondHalf.lateMinutes = sorted[0].lateMinutes || 0;
          }
        } else if (sorted[0].checkOut) {
          const checkOutDate = new Date(sorted[0].checkOut);
          const coIstStr = checkOutDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
          const [coH, coM] = coIstStr.split(':').map(Number);
          const [shH, shM] = boundaries.secondHalf.start.split(':').map(Number);
          if ((coH * 60 + coM) >= (shH * 60 + shM)) {
            const dObj = new Date(sorted[0].checkIn || sorted[0].checkOut || date);
            const istDateStr = dObj.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
            const [mStr, dayStr, yStr] = istDateStr.split('/');
            const y = parseInt(yStr);
            const m = parseInt(mStr);
            const d = parseInt(dayStr);
            const [fhEndH, fhEndM] = boundaries.firstHalf.end.split(':').map(Number);
            const [shStartH, shStartM] = boundaries.secondHalf.start.split(':').map(Number);

            const fhEndDate = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(fhEndH).padStart(2, '0')}:${String(fhEndM).padStart(2, '0')}:00+05:30`);
            const shStartDate = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(shStartH).padStart(2, '0')}:${String(shStartM).padStart(2, '0')}:00+05:30`);

            firstHalf.checkIn = sorted[0].checkIn || firstHalf.checkIn;
            firstHalf.checkOut = fhEndDate;
            if (firstHalf.status !== 'leave') {
              firstHalf.status = sorted[0].lateMinutes > 0 ? 'late' : 'present';
              firstHalf.lateMinutes = sorted[0].lateMinutes || 0;
            }

            secondHalf.checkIn = shStartDate;
            secondHalf.checkOut = sorted[0].checkOut || secondHalf.checkOut;
            if (secondHalf.status !== 'leave') {
              secondHalf.status = 'present';
            }
          }
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

        if (existingAttendance.logoutTime && !shLeave) {
          const checkOutDate = new Date(existingAttendance.logoutTime);
          const coIstStr = checkOutDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
          const [coH, coM] = coIstStr.split(':').map(Number);
          const [shH, shM] = boundaries.secondHalf.start.split(':').map(Number);
          if ((coH * 60 + coM) >= (shH * 60 + shM)) {
            const dObj = new Date(existingAttendance.loginTime || existingAttendance.logoutTime || date);
            const istDateStr = dObj.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
            const [mStr, dayStr, yStr] = istDateStr.split('/');
            const y = parseInt(yStr);
            const m = parseInt(mStr);
            const d = parseInt(dayStr);
            const [fhEndH, fhEndM] = boundaries.firstHalf.end.split(':').map(Number);
            const [shStartH, shStartM] = boundaries.secondHalf.start.split(':').map(Number);

            const fhEndDate = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(fhEndH).padStart(2, '0')}:${String(fhEndM).padStart(2, '0')}:00+05:30`);
            const shStartDate = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(shStartH).padStart(2, '0')}:${String(shStartM).padStart(2, '0')}:00+05:30`);

            firstHalf.checkOut = fhEndDate;
            secondHalf.checkIn = shStartDate;
            secondHalf.checkOut = existingAttendance.logoutTime;
            if (secondHalf.status !== 'leave') {
              secondHalf.status = 'present';
            }
          }
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

  let totalWorkedHours = 0;
  if (existingAttendance?.sessions && existingAttendance.sessions.length > 1) {
    let sessMinutes = 0;
    existingAttendance.sessions.forEach((s: any) => {
      if (s.checkIn && s.checkOut) {
        sessMinutes += Math.max(0, (new Date(s.checkOut).getTime() - new Date(s.checkIn).getTime()) / (1000 * 60));
      }
    });
    totalWorkedHours = sessMinutes / 60;
  } else if (existingAttendance?.loginTime && existingAttendance?.logoutTime) {
    totalWorkedHours = Math.max(0, (new Date(existingAttendance.logoutTime).getTime() - new Date(existingAttendance.loginTime).getTime()) / (1000 * 60 * 60));
  } else if (existingAttendance?.sessions && existingAttendance.sessions.length === 1 && existingAttendance.sessions[0].checkIn && existingAttendance.sessions[0].checkOut) {
    totalWorkedHours = Math.max(0, (new Date(existingAttendance.sessions[0].checkOut).getTime() - new Date(existingAttendance.sessions[0].checkIn).getTime()) / (1000 * 60 * 60));
  } else {
    totalWorkedHours = (firstHalf.workedHours || 0) + (secondHalf.workedHours || 0);
  }

  let scheduledMinutes = 0;
  if (shift?.sessions && Array.isArray(shift.sessions) && shift.sessions.length > 0) {
    shift.sessions.forEach((s: any) => {
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      let dur = (eh * 60 + em) - (sh * 60 + sm);
      if (dur < 0) dur += 24 * 60;
      scheduledMinutes += dur;
    });
  } else if (shift?.startTime && shift?.endTime) {
    const [sh, sm] = shift.startTime.split(':').map(Number);
    const [eh, em] = shift.endTime.split(':').map(Number);
    let dur = (eh * 60 + em) - (sh * 60 + sm);
    if (dur < 0) dur += 24 * 60;
    scheduledMinutes += dur;
  }

  const workedMinutes = Math.round(totalWorkedHours * 60);
  let totalExtraMinutes = 0;
  if (scheduledMinutes > 0 && workedMinutes > scheduledMinutes) {
    totalExtraMinutes = workedMinutes - scheduledMinutes;
  }

  const shiftStartTimeStr = shift?.startTime || shift?.sessions?.[0]?.startTime || '09:00';
  const shiftEndTimeStr = shift?.endTime || shift?.sessions?.[shift?.sessions?.length - 1]?.endTime || '18:00';

  const [stH, stM] = shiftStartTimeStr.split(':').map(Number);
  const [etH, etM] = shiftEndTimeStr.split(':').map(Number);

  const dObj = new Date(date || existingAttendance?.date || new Date());
  const istDateStr = dObj.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
  const [mStr, dayStr, yStr] = istDateStr.split('/');
  const y = parseInt(yStr);
  const m = parseInt(mStr);
  const d = parseInt(dayStr);

  const shiftStart = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(stH).padStart(2, '0')}:${String(stM).padStart(2, '0')}:00+05:30`);
  const shiftEnd = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(etH).padStart(2, '0')}:${String(etM).padStart(2, '0')}:00+05:30`);

  let extraBeforeShiftMinutes = 0;
  let extraAfterShiftMinutes = 0;
  const inTime = existingAttendance?.loginTime || existingAttendance?.sessions?.[0]?.checkIn || firstHalf.checkIn;
  const outTime = existingAttendance?.logoutTime || existingAttendance?.sessions?.[existingAttendance?.sessions?.length - 1]?.checkOut || secondHalf.checkOut;

  if (inTime && new Date(inTime) < shiftStart) {
    extraBeforeShiftMinutes = Math.max(0, Math.round((shiftStart.getTime() - new Date(inTime).getTime()) / (1000 * 60)));
  }
  if (outTime && new Date(outTime) > shiftEnd) {
    extraAfterShiftMinutes = Math.max(0, Math.round((new Date(outTime).getTime() - shiftEnd.getTime()) / (1000 * 60)));
  }

  const previouslyUsed = (existingAttendance?.totalExtraMinutes || 0) - (existingAttendance?.availableExtraMinutes || 0);
  const newlyUsed = isNaN(previouslyUsed) || previouslyUsed < 0 ? 0 : previouslyUsed;
  const availableExtraMinutes = Math.max(0, totalExtraMinutes - newlyUsed);

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
    if (existingAttendance?.status === 'present' || existingAttendance?.status === 'late') {
      finalStatus = existingAttendance.status;
    } else {
      finalStatus = 'half-day';
    }
  }

  const totalLateMinutes = (firstHalf.lateMinutes || 0) + (secondHalf.lateMinutes || 0);

  return {
    firstHalf,
    secondHalf,
    totalWorkedHours: parseFloat(totalWorkedHours.toFixed(2)),
    paidLeaveDays,
    unpaidLeaveDays,
    totalLeaveDays,
    status: finalStatus,
    finalStatus,
    lateMinutes: totalLateMinutes,
    permissionMinutes: totalPermissionMinutes,
    permissionStart: primaryStart,
    permissionEnd: primaryEnd,
    effectiveCheckInStart,
    scheduledMinutes,
    workedMinutes,
    totalExtraMinutes,
    availableExtraMinutes,
    extraBeforeShiftMinutes,
    extraAfterShiftMinutes
  };
}

/**
 * Automatically syncs an approved leave record into the Attendance collection.
 */
export async function syncLeaveToAttendance(leave: any, overrideApproved: boolean = false) {
  if (!leave || (leave.status !== 'approved' && !overrideApproved)) return;

  const Attendance = (await import('@/models/Attendance')).default;
  const Shift = (await import('@/models/Shift')).default;
  const User = (await import('@/models/User')).default;

  const user = await User.findById(leave.userId, null, { bypassTenant: true }).populate({ path: 'shiftId', options: { bypassTenant: true } }).lean();
  if (!user) return;

  const shift = user.shiftId as any;
  const startDate = new Date(leave.fromDate);
  const endDate = new Date(leave.toDate);

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  const VALID_ATTENDANCE_STATUSES = [
    'present', 'absent', 'half-day', 'late', 'Weekly Off', 'Work From Home',
    'On Duty', 'Restricted Holiday', 'Leave', 'Holiday',
    'Sick Leave', 'Casual Leave', 'Compensatory Off', 'Maternity Leave', 'Paternity Leave', 'Leave Without Pay'
  ];
  const fullDayStatus = VALID_ATTENDANCE_STATUSES.includes(leave.leaveType) ? leave.leaveType : 'Leave';
  const isPaid = isLeaveTypePaid(leave.leaveType);

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const attendanceDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));

    let attendance = await Attendance.findOne({ userId: leave.userId, date: attendanceDate }, null, { bypassTenant: true });
    if (!attendance) {
      attendance = new Attendance({
        userId: leave.userId,
        date: attendanceDate,
        shiftId: shift?._id,
        status: leave.duration === 'half_day' ? 'half-day' : fullDayStatus,
        companyId: leave.companyId || user.companyId
      });
    }

    if (leave.duration === 'full_day' || !leave.halfDaySession) {
      attendance.status = fullDayStatus;
      attendance.firstHalf = {
        status: 'leave',
        leaveId: leave._id,
        leaveType: leave.leaveType
      };
      attendance.secondHalf = {
        status: 'leave',
        leaveId: leave._id,
        leaveType: leave.leaveType
      };
      if (isPaid) {
        attendance.paidLeaveDays = 1;
        attendance.unpaidLeaveDays = 0;
      } else {
        attendance.paidLeaveDays = 0;
        attendance.unpaidLeaveDays = 1;
      }
    } else if (leave.duration === 'half_day') {
      attendance.status = 'half-day';
      if (leave.halfDaySession === 'first_half') {
        attendance.firstHalf = {
          status: 'leave',
          leaveId: leave._id,
          leaveType: leave.leaveType
        };
        if (!attendance.secondHalf?.status || attendance.secondHalf.status === 'leave') {
          attendance.secondHalf = { status: null };
        }
      } else if (leave.halfDaySession === 'second_half') {
        attendance.secondHalf = {
          status: 'leave',
          leaveId: leave._id,
          leaveType: leave.leaveType
        };
        if (!attendance.firstHalf?.status || attendance.firstHalf.status === 'leave') {
          attendance.firstHalf = { status: null };
        }
      }
      if (isPaid) {
        attendance.paidLeaveDays = (attendance.paidLeaveDays || 0) + 0.5;
      } else {
        attendance.unpaidLeaveDays = (attendance.unpaidLeaveDays || 0) + 0.5;
      }
    }

    await attendance.save({ bypassTenant: true } as any);
  }
}
