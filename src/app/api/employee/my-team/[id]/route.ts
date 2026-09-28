import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import Leave from '@/models/Leave';
import Permission from '@/models/Permission';
import '@/models/Shift';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: employeeId } = await params;

    await dbConnect();

    // Check if the employee actually reports to the logged-in user
    const currentUserId = session.user.id;
    const employee = await User.findOne({ _id: employeeId, reportsTo: currentUserId }, null, { bypassTenant: true })
      .select('-password -__v') // exclude sensitive fields
      .populate('shiftId')
      .populate('companyId', 'name')
      .populate('reportsTo', 'name')
      .lean();

    if (!employee) {
      // Return 403 or 404 to ensure they can't access arbitrary employees
      return NextResponse.json({ error: 'Employee not found or not in your team' }, { status: 403 });
    }

    // Determine the month and year from search params (or default to current)
    const url = new URL(req.url);
    const monthParam = url.searchParams.get('month');
    const yearParam = url.searchParams.get('year');

    const now = new Date();
    const selectedMonth = monthParam ? parseInt(monthParam) - 1 : now.getMonth();
    const selectedYear = yearParam ? parseInt(yearParam) : now.getFullYear();

    const startOfMonth = new Date(Date.UTC(selectedYear, selectedMonth, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999));
    const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    // Determine current date in IST
    const istDateString = now.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
    const [istMonth, istDay, istYear] = istDateString.split('/');
    const todayUtc = new Date(Date.UTC(parseInt(istYear), parseInt(istMonth) - 1, parseInt(istDay), 0, 0, 0, 0));

    // Shift working days
    const shift = employee.shiftId as any;
    const workingDaysPattern: string[] = (shift && Array.isArray(shift.workingDays) && shift.workingDays.length > 0)
      ? shift.workingDays
      : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    // Fetch Holidays
    const Holiday = (await import('@/models/Holiday')).default;
    const holidays = await Holiday.find({
      date: { $gte: startOfMonth, $lte: endOfMonth }
    }, null, { bypassTenant: true }).lean();

    // Fetch Approved Leaves
    const leaves = await Leave.find({
      userId: employeeId,
      status: 'approved',
      $or: [
        { fromDate: { $lte: endOfMonth }, toDate: { $gte: startOfMonth } }
      ]
    }, null, { bypassTenant: true }).lean();

    // Fetch Attendance
    const existingAttendances = await Attendance.find({
      userId: employeeId,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    }, null, { bypassTenant: true }).sort({ date: -1 }).lean();

    let present = 0;
    let absent = 0;
    let late = 0;
    let halfDay = 0;
    let leaveCount = 0;

    const allAttendances: any[] = [];
    const processedDates = new Set<string>();

    existingAttendances.forEach((att: any) => {
      const d = new Date(att.date);
      const dKey = d.toISOString().slice(0, 10);
      processedDates.add(dKey);
      allAttendances.push(att);

      const status = (att.status || '').toLowerCase();
      if (status === 'present' || status === 'work from home' || status === 'on duty') {
        present++;
      } else if (status === 'late') {
        late++;
      } else if (status === 'absent') {
        absent++;
      } else if (status === 'half-day') {
        halfDay++;
        if (att.firstHalf?.status === 'absent' || att.secondHalf?.status === 'absent') {
          absent += 0.5;
          present += 0.5;
        }
      } else if (status.includes('leave') || status === 'leave') {
        leaveCount++;
      }
    });

    const isCurrentMonth = selectedYear === todayUtc.getUTCFullYear() && selectedMonth === todayUtc.getUTCMonth();
    const isPastMonth = selectedYear < todayUtc.getUTCFullYear() || (selectedYear === todayUtc.getUTCFullYear() && selectedMonth < todayUtc.getUTCMonth());

    let maxDayToEvaluate = 0;
    if (isPastMonth) {
      maxDayToEvaluate = totalDaysInMonth;
    } else if (isCurrentMonth) {
      maxDayToEvaluate = todayUtc.getUTCDate();
    }

    const joiningDate = employee.joiningDate ? new Date(new Date(employee.joiningDate).setUTCHours(0, 0, 0, 0)) : null;

    for (let dayNum = 1; dayNum <= maxDayToEvaluate; dayNum++) {
      const dayUtc = new Date(Date.UTC(selectedYear, selectedMonth, dayNum, 0, 0, 0, 0));
      const dKey = dayUtc.toISOString().slice(0, 10);

      if (processedDates.has(dKey)) {
        continue;
      }

      if (joiningDate && dayUtc < joiningDate) {
        continue;
      }

      const holiday = holidays.find((h: any) => {
        const hDate = new Date(h.date);
        return hDate.getUTCFullYear() === dayUtc.getUTCFullYear() &&
               hDate.getUTCMonth() === dayUtc.getUTCMonth() &&
               hDate.getUTCDate() === dayUtc.getUTCDate();
      });
      const isMandatoryHoliday = holiday && (holiday.holidayType === 'public' || holiday.holidayType === 'company');
      if (isMandatoryHoliday) {
        continue;
      }

      const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(dayUtc);
      const isWeeklyOff = workingDaysPattern.length > 0
        ? !workingDaysPattern.some((wd: string) => wd.toLowerCase() === dayName.toLowerCase())
        : dayUtc.getUTCDay() === 0;

      const dayLeaves = leaves.filter((l: any) => {
        const from = new Date(l.fromDate);
        const to = new Date(l.toDate);
        from.setUTCHours(0, 0, 0, 0);
        to.setUTCHours(23, 59, 59, 999);
        return dayUtc >= from && dayUtc <= to;
      });

      if (dayLeaves.length > 0) {
        const leave = dayLeaves[0];
        leaveCount += (leave.duration === 'half_day' ? 0.5 : 1);
        allAttendances.push({
          _id: `leave_${leave._id}_${dKey}`,
          userId: employeeId,
          date: dayUtc,
          status: leave.leaveType || 'Leave',
          loginTime: null,
          logoutTime: null
        });
        continue;
      }

      if (isWeeklyOff) {
        continue;
      }

      // Past working day or today without punch: mark absent
      const isPast = dayUtc < todayUtc;
      if (isPast) {
        absent++;
        allAttendances.push({
          _id: `absent_${dKey}`,
          userId: employeeId,
          date: dayUtc,
          status: 'absent',
          loginTime: null,
          logoutTime: null
        });
      } else if (dayUtc.getTime() === todayUtc.getTime()) {
        absent++;
        allAttendances.push({
          _id: `absent_${dKey}`,
          userId: employeeId,
          date: dayUtc,
          status: 'absent',
          loginTime: null,
          logoutTime: null
        });
      }
    }

    allAttendances.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Fetch Permissions for the month
    const recentPermissions = await Permission.find({ userId: employeeId }, null, { bypassTenant: true })
      .sort({ date: -1 })
      .limit(10)
      .lean();

    const attendanceSummary = {
      present,
      absent,
      late,
      halfDay,
      leave: leaveCount,
      permission: recentPermissions.length,
      total: allAttendances.length
    };

    // Fetch Leaves for the month and all-time leaves history (limited)
    const recentLeaves = await Leave.find({ userId: employeeId }, null, { bypassTenant: true })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Fetch leave balance
    const leaveBalance = employee.leaveBalance || null;

    return NextResponse.json({
      employee,
      attendances: allAttendances,
      attendanceSummary,
      recentLeaves,
      recentPermissions,
      leaveBalance
    });

  } catch (error) {
    console.error('Error fetching employee details for My Team:', error);
    return NextResponse.json({ error: 'Failed to fetch employee details' }, { status: 500 });
  }
}
