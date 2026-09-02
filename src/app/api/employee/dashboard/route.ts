import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import Leave from '@/models/Leave';
import '@/models/Shift';
import Holiday from '@/models/Holiday';
import { getActiveSessionInfo } from '@/lib/sessionUtils';
import { isSameDay } from 'date-fns';

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const now = new Date();
    const istDateString = now.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
    const [month, day, year] = istDateString.split('/');
    const today = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0));
    const user = await User.findById(session.user.id, null, { bypassTenant: true })
      .populate('shiftId')
      .populate('reportsTo', 'employeeId name role designation department profileImage')
      .lean() as any;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const subordinates = await User.find({ reportsTo: session.user.id })
      .select('employeeId name role designation department profileImage')
      .lean();

    // Attendances
    const attendances = await Attendance.find({ userId: session.user.id }).sort({ date: -1 }).limit(30);
    const todayAttendance = attendances.find(a => new Date(a.date).getTime() === today.getTime());

    // Calculate Monthly %
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthAttendances = attendances.filter(a => new Date(a.date) >= firstDayOfMonth);
    const presentDays = monthAttendances.filter(a => a.status === 'present' || a.status === 'late').length;

    // Ideally calculate total working days till today
    const holidaysThisMonth = await Holiday.find({
      date: { $gte: firstDayOfMonth, $lte: today },
      holidayType: { $in: ['public', 'company'] }
    });

    const shiftWorkingDays = user?.shiftId?.workingDays?.map((d: string) => d.toLowerCase()) ||
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    let workingDays = 0;
    for (let d = new Date(firstDayOfMonth); d <= today; d.setDate(d.getDate() + 1)) {
      const dayName = daysOfWeek[d.getDay()];

      if (shiftWorkingDays.includes(dayName)) {
        // Check if day is a holiday
        const isHoliday = holidaysThisMonth.some(h => isSameDay(new Date(h.date), d));
        if (!isHoliday) {
          workingDays++;
        }
      }
    }
    const attendancePercentage = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 100;

    // Leaves
    const leaves = await Leave.find({ userId: session.user.id, status: 'approved' });
    let takenLeaves = 0;
    let halfDayCount = 0;

    leaves.forEach(l => {
      takenLeaves += l.numberOfDays || 0;
      if (l.duration === 'half_day') {
        halfDayCount += 1;
      }
    });

    // Use the actual leaveBalance from user if available, otherwise fallback
    let availableLeave = 0;
    if (user.leaveBalance) {
      availableLeave =
        (user.leaveBalance.casualLeave?.available || 0) +
        (user.leaveBalance.sickLeave?.available || 0) +
        (user.leaveBalance.restrictedLeave?.available || 0) +
        (user.leaveBalance.compensatoryOff?.available || 0);
    } else {
      availableLeave = 24 - takenLeaves;
    }

    // Recent
    const recentAttendances = attendances.slice(0, 5).map(a => ({
      date: a.date,
      loginTime: a.loginTime,
      logoutTime: a.logoutTime,
      status: a.status
    }));

    // Upcoming Leaves
    const upcomingLeaves = await Leave.find({
      userId: session.user.id,
      fromDate: { $gte: today },
      status: { $in: ['pending', 'approved'] }
    }).sort({ fromDate: 1 }).limit(3);

    const activeDeductions = [];
    if (user.salaryDeductions?.esi?.enabled) {
      activeDeductions.push({ type: 'ESI', amount: user.salaryDeductions.esi.amount });
    }
    if (user.salaryDeductions?.loan?.enabled && user.salaryDeductions.loan.remainingMonths > 0) {
      activeDeductions.push({
        type: 'Loan',
        amount: user.salaryDeductions.loan.monthlyDeduction,
        remainingMonths: user.salaryDeductions.loan.remainingMonths
      });
    }

    const currentIstTime = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
    const shift = user?.shiftId;
    let sessionStatus = 'NO_SHIFT';
    let activeSessionInfo = null;

    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const todayLeave = await Leave.findOne({
      userId: session.user.id,
      status: 'approved',
      fromDate: { $lte: todayEnd },
      toDate: { $gte: todayStart }
    });

    if (shift && shift.sessions) {
      activeSessionInfo = getActiveSessionInfo(shift.sessions, todayAttendance?.sessions || [], currentIstTime, todayLeave, shift);
      sessionStatus = activeSessionInfo.currentStatus;

      if (todayAttendance) {
        (todayAttendance as any).activeSessionInfo = activeSessionInfo;
      }
    }

    return NextResponse.json({
      shift,
      todayAttendance,
      sessionStatus,
      activeSessionInfo,
      attendancePercentage,
      presentDays,
      workingDays,
      leaveBalance: availableLeave,
      rawLeaveBalance: user?.leaveBalance,
      availableLeave,
      takenLeaves,
      halfDayCount,
      recentAttendances,
      upcomingLeaves,
      manager: user?.reportsTo || null,
      subordinates,
      currentUser: {
        employeeId: user?.employeeId,
        name: user?.name,
        role: user?.role,
        designation: user?.designation,
        department: user?.department,
        profileImage: user?.profileImage
      },
      activeDeductions
    });

  } catch (error) {
    console.error('Error fetching employee dashboard:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
