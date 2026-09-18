import dbConnect from './mongodb';
import Attendance from '@/models/Attendance';
import User from '@/models/User';
import Shift from '@/models/Shift';
import Leave from '@/models/Leave';
import Permission from '@/models/Permission';
import Holiday from '@/models/Holiday';
import { calculateHalfSession } from './halfDayUtils';

export interface PermissionInterval {
  fromTime: string; // HH:mm
  toTime: string;   // HH:mm
  startMins: number;
  endMins: number;
  duration: number;
}

export function parseTimeToMinutes(timeStr: string | Date | null | undefined): number {
  if (!timeStr) return 0;
  if (timeStr instanceof Date) {
    const istStr = timeStr.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
    const [h, m] = istStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }
  const parts = String(timeStr).split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

export function minutesToTimeString(mins: number): string {
  const normalizedMins = Math.max(0, mins % (24 * 60));
  const h = Math.floor(normalizedMins / 60);
  const m = normalizedMins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function isPermissionApproved(status: string): boolean {
  if (!status) return false;
  const approvedStatuses = ['Approved', 'Pending Compensation', 'Partially Compensated', 'Fully Compensated', 'approved'];
  return approvedStatuses.includes(status);
}

/**
 * Merges overlapping or contiguous approved permission intervals for an employee on a single date.
 */
export function mergePermissionIntervals(permissions: any[]): {
  mergedIntervals: PermissionInterval[];
  totalPermissionMinutes: number;
  primaryStart: string | undefined;
  primaryEnd: string | undefined;
} {
  const validPermissions = (permissions || []).filter(p => isPermissionApproved(p.status));
  if (validPermissions.length === 0) {
    return {
      mergedIntervals: [],
      totalPermissionMinutes: 0,
      primaryStart: undefined,
      primaryEnd: undefined
    };
  }

  const rawIntervals: PermissionInterval[] = validPermissions.map(p => {
    const startMins = parseTimeToMinutes(p.fromTime);
    let endMins = parseTimeToMinutes(p.toTime);
    if (endMins <= startMins && p.duration > 0) {
      endMins = startMins + p.duration;
    }
    return {
      fromTime: p.fromTime,
      toTime: p.toTime,
      startMins,
      endMins: endMins < startMins ? endMins + 24 * 60 : endMins,
      duration: p.duration || Math.max(0, endMins - startMins)
    };
  });

  rawIntervals.sort((a, b) => a.startMins - b.startMins);

  const mergedIntervals: PermissionInterval[] = [];
  for (const interval of rawIntervals) {
    if (mergedIntervals.length === 0) {
      mergedIntervals.push({ ...interval });
    } else {
      const last = mergedIntervals[mergedIntervals.length - 1];
      if (interval.startMins <= last.endMins) {
        last.endMins = Math.max(last.endMins, interval.endMins);
        last.toTime = minutesToTimeString(last.endMins);
        last.duration = last.endMins - last.startMins;
      } else {
        mergedIntervals.push({ ...interval });
      }
    }
  }

  const totalPermissionMinutes = mergedIntervals.reduce((sum, item) => sum + item.duration, 0);
  const primaryStart = mergedIntervals[0]?.fromTime || undefined;
  const primaryEnd = mergedIntervals[mergedIntervals.length - 1]?.toTime || undefined;

  return {
    mergedIntervals,
    totalPermissionMinutes,
    primaryStart,
    primaryEnd
  };
}

/**
 * Checks whether a permission interval is a morning permission (i.e., overlaps shift start).
 */
export function isMorningPermission({
  shiftStart,
  permissionStart,
  permissionEnd
}: {
  shiftStart: string;
  permissionStart: string;
  permissionEnd: string;
}): boolean {
  const shiftStartMins = parseTimeToMinutes(shiftStart);
  const permStartMins = parseTimeToMinutes(permissionStart);
  let permEndMins = parseTimeToMinutes(permissionEnd);
  if (permEndMins < permStartMins) permEndMins += 24 * 60;

  return permStartMins <= shiftStartMins && permEndMins > shiftStartMins;
}

/**
 * Calculates effective expected check-in time considering morning permissions.
 */
export function calculateEffectiveExpectedCheckIn({
  shiftStart,
  permissions
}: {
  shiftStart: string;
  permissions: any[];
}): { effectiveCheckInStart: string; effectiveCheckInMinutes: number; morningPermission: PermissionInterval | null } {
  const shiftStartMins = parseTimeToMinutes(shiftStart);
  const { mergedIntervals } = mergePermissionIntervals(permissions);

  const morningPerm = mergedIntervals.find(interval => 
    isMorningPermission({
      shiftStart,
      permissionStart: interval.fromTime,
      permissionEnd: interval.toTime
    })
  );

  if (morningPerm) {
    const effectiveMins = Math.max(shiftStartMins, morningPerm.endMins);
    return {
      effectiveCheckInStart: minutesToTimeString(effectiveMins),
      effectiveCheckInMinutes: effectiveMins,
      morningPermission: morningPerm
    };
  }

  return {
    effectiveCheckInStart: shiftStart,
    effectiveCheckInMinutes: shiftStartMins,
    morningPermission: null
  };
}

/**
 * Recalculates and saves attendance for a given user and date taking shift, leaves, and permissions into account.
 */
export async function recalculateAttendanceForUserAndDate(userId: any, date: Date | string) {
  await dbConnect();

  const user = await User.findById(userId, null, { bypassTenant: true })
    .populate({ path: 'shiftId', options: { bypassTenant: true } })
    .lean();

  if (!user) return null;

  const targetDate = new Date(date);
  const year = targetDate.getUTCFullYear();
  const month = targetDate.getUTCMonth();
  const day = targetDate.getUTCDate();

  const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

  // Load existing attendance
  let attendance = await Attendance.findOne({
    userId,
    date: { $gte: startOfDay, $lte: endOfDay }
  }, null, { bypassTenant: true });

  // Load approved leaves
  const approvedLeaves = await Leave.find({
    userId,
    status: 'approved',
    fromDate: { $lte: endOfDay },
    toDate: { $gte: startOfDay }
  }, null, { bypassTenant: true }).lean();

  // Load approved permissions
  const approvedPermissions = await Permission.find({
    userId,
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['Approved', 'Pending Compensation', 'Partially Compensated', 'Fully Compensated'] as any }
  }, null, { bypassTenant: true }).lean();

  // Check Holiday
  const holiday = await Holiday.findOne({
    date: { $gte: startOfDay, $lte: endOfDay },
    holidayType: { $in: ['public', 'company'] }
  }, null, { bypassTenant: true });

  const shift = user.shiftId as any;
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[targetDate.getUTCDay()];
  const isWeeklyOff = shift && Array.isArray(shift.workingDays) && shift.workingDays.length > 0
    ? !shift.workingDays.map((d: string) => d.toLowerCase()).includes(dayName.toLowerCase())
    : targetDate.getUTCDay() === 0;

  const { calculateDailyAttendance } = await import('./halfDayUtils');
  const calc = calculateDailyAttendance({
    shift,
    date: startOfDay,
    existingAttendance: attendance,
    approvedLeaves,
    approvedPermissions,
    isHoliday: !!holiday,
    isWeeklyOff
  });

  if (!attendance) {
    // If no check-in, leaves, or permissions exist, return null without creating empty record unless needed
    if (!calc.firstHalf.checkIn && !calc.secondHalf.checkIn && approvedLeaves.length === 0 && approvedPermissions.length === 0) {
      return null;
    }

    attendance = new Attendance({
      companyId: user.companyId,
      userId,
      date: startOfDay,
      shiftId: shift?._id,
      status: calc.finalStatus
    });
  }

  attendance.firstHalf = calc.firstHalf;
  attendance.secondHalf = calc.secondHalf;
  attendance.status = calc.finalStatus;
  attendance.totalHours = calc.totalWorkedHours;
  attendance.paidLeaveDays = calc.paidLeaveDays;
  attendance.unpaidLeaveDays = calc.unpaidLeaveDays;
  attendance.lateMinutes = calc.lateMinutes;

  attendance.scheduledMinutes = calc.scheduledMinutes;
  attendance.workedMinutes = calc.workedMinutes;
  attendance.totalExtraMinutes = calc.totalExtraMinutes;
  attendance.availableExtraMinutes = calc.availableExtraMinutes;
  attendance.extraBeforeShiftMinutes = calc.extraBeforeShiftMinutes;
  attendance.extraAfterShiftMinutes = calc.extraAfterShiftMinutes;

  attendance.permissionMinutes = calc.permissionMinutes;
  attendance.permissionStart = calc.permissionStart;
  attendance.permissionEnd = calc.permissionEnd;
  attendance.effectiveCheckInStart = calc.effectiveCheckInStart;

  await attendance.save({ bypassTenant: true } as any);
  return attendance;
}
