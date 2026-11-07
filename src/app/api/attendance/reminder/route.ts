import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import Leave from '@/models/Leave';
import Notification from '@/models/Notification';
import Shift, { IShift } from '@/models/Shift';
import Holiday from '@/models/Holiday';
import { sendWebPushNotification } from '@/lib/sendWebPushNotification';
import { isWeeklyOff as checkWeeklyOff } from '@/lib/workingDays';
import mongoose from 'mongoose';

// Ensure Shift model is loaded in Mongoose schema cache
void Shift;

// Helper to determine today's date range and day name in IST
function getTodayISTDateRange() {
  const now = new Date();
  const istDateString = now.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
  const [month, day, year] = istDateString.split('/');

  const todayStart = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0));
  const todayEnd = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59, 999));
  const formattedDate = new Date(todayStart).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const dayName = new Date(todayStart).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'Asia/Kolkata',
  });

  return { todayStart, todayEnd, formattedDate, dayName };
}

// Helper to process attendance reminders for a given type ('check-in' or 'check-out')
async function processReminders({
  type,
  companyId,
}: {
  type: 'check-in' | 'check-out';
  companyId?: string | null;
}) {
  const { todayStart, todayEnd, formattedDate, dayName } = getTodayISTDateRange();

  // 1. Pre-fetch today's public and company holidays
  const todayHolidays = await Holiday.find(
    {
      date: { $gte: todayStart, $lte: todayEnd },
      holidayType: { $in: ['public', 'company'] },
    },
    null,
    { bypassTenant: true }
  ).lean();

  // 2. Build user query - include all active staff and employees
  const query: Record<string, unknown> = {
    isActive: true,
  };

  if (companyId) {
    query.companyId = new mongoose.Types.ObjectId(companyId);
  }

  // Populate shiftId to inspect workingDays pattern
  const activeEmployees = await User.find(query, null, { bypassTenant: true })
    .populate('shiftId')
    .lean();

  const remindersSent: string[] = [];
  let pushCount = 0;
  let inAppCount = 0;

  for (const employee of activeEmployees) {
    // 3. Check if today is a Holiday for this employee's company or public
    const isHoliday = todayHolidays.some((h) => {
      if (!h.companyId) return true; // public holiday applies to everyone
      return employee.companyId && h.companyId.toString() === employee.companyId.toString();
    });

    if (isHoliday && type === 'check-in') {
      continue; // Never send check-in reminders on holidays
    }

    // 4. Check if today is a Weekly Off according to the employee's assigned shift
    const shift = employee.shiftId as unknown as IShift | null;
    const isWeeklyOff = checkWeeklyOff(todayStart, shift, { useUTC: true });

    if (isWeeklyOff && type === 'check-in') {
      continue; // Skip employee on weekly off
    }

    // 5. Check if employee has an approved leave today
    const approvedLeaves = await Leave.find(
      {
        userId: employee._id,
        status: 'approved',
        fromDate: { $lte: todayEnd },
        toDate: { $gte: todayStart },
      },
      null,
      { bypassTenant: true }
    ).lean();

    const isFullDayApproved = approvedLeaves.some((l) => l.duration !== 'half_day');
    const hasFirstHalfApproved = approvedLeaves.some(
      (l) => l.duration === 'half_day' && l.halfDaySession === 'first_half'
    );
    const hasSecondHalfApproved = approvedLeaves.some(
      (l) => l.duration === 'half_day' && l.halfDaySession === 'second_half'
    );

    if (type === 'check-in' && (isFullDayApproved || hasFirstHalfApproved)) {
      continue; // Skip employee on full-day or first-half approved leave
    }

    if (type === 'check-out' && (isFullDayApproved || hasSecondHalfApproved)) {
      continue; // Skip employee on full-day or second-half approved leave
    }

    // 6. Check today's attendance record
    const todayAttendance = await Attendance.findOne(
      {
        userId: employee._id,
        date: { $gte: todayStart, $lte: todayEnd },
      },
      null,
      { bypassTenant: true }
    );

    const hasCheckedIn = Boolean(
      todayAttendance?.loginTime ||
      todayAttendance?.firstHalf?.checkIn ||
      (Array.isArray(todayAttendance?.sessions) && todayAttendance.sessions.some((s) => s.checkIn))
    );

    const hasCheckedOut = Boolean(
      todayAttendance?.logoutTime ||
      todayAttendance?.secondHalf?.checkOut ||
      (Array.isArray(todayAttendance?.sessions) &&
        todayAttendance.sessions.length > 0 &&
        todayAttendance.sessions.every((s) => s.checkOut))
    );

    let shouldSend = false;
    let title = '';
    let body = '';

    if (type === 'check-in') {
      // Has not checked in yet
      if (!hasCheckedIn) {
        shouldSend = true;
        title = 'Action Required: Daily Attendance Check-In Reminder';
        body = `Hi ${employee.name}, please remember to mark your check-in attendance for today (${formattedDate}).`;
      }
    } else if (type === 'check-out') {
      // Checked in, but hasn't checked out yet
      if (hasCheckedIn && !hasCheckedOut) {
        shouldSend = true;
        title = 'Action Required: Daily Attendance Check-Out Reminder';
        body = `Hi ${employee.name}, please remember to check out before leaving to ensure your work hours are tracked.`;
      }
    }

    if (!shouldSend) continue;

    remindersSent.push(employee.name);

    // a. Send Web Push Notification via Firebase Cloud Messaging
    try {
      const pushRes = await sendWebPushNotification(employee._id.toString(), {
        title,
        body,
        data: {
          url: '/employee/attendance',
          type: `reminder_${type}`,
          tag: `attendance_reminder_${type}`,
        },
      });
      if (pushRes.sent > 0) {
        pushCount += pushRes.sent;
      }
    } catch (pushErr) {
      console.error(`Failed to send web push reminder to ${employee.email || employee.name}:`, pushErr);
    }

    // b. Create In-App Notification (shows under bell icon)
    try {
      await Notification.create({
        companyId: employee.companyId || undefined,
        recipientId: employee._id,
        type: `attendance_reminder_${type}`,
        message: body,
        isRead: false,
        link: '/employee/attendance',
      });
      inAppCount++;
    } catch (notifErr) {
      console.warn(`Failed to create in-app notification record for ${employee.name}:`, notifErr);
    }
  }

  return {
    evaluatedCount: activeEmployees.length,
    remindersSent,
    pushCount,
    inAppCount,
  };
}

// GET handler for scheduled CRON triggers (e.g. from Vercel Cron or GitHub Actions)
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const typeParam = searchParams.get('type') === 'check-out' ? 'check-out' : 'check-in';

    await dbConnect();
    const result = await processReminders({ type: typeParam });

    return NextResponse.json(
      {
        success: true,
        type: typeParam,
        message: `${typeParam === 'check-in' ? 'Check-In' : 'Check-Out'} push reminders processed for ${result.remindersSent.length} employees (Push: ${result.pushCount}, In-App: ${result.inAppCount}).`,
        ...result,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('CRON Error [Attendance Reminder]:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: message }, { status: 500 });
  }
}

// POST handler for manual Admin trigger from Dashboard
export async function POST(req: Request) {
  try {
    const session = await auth();
    const user = session?.user as { id?: string; role?: string; companyId?: string } | undefined;
    const role = user?.role;
    if (!user?.id || !role || !['admin', 'super_admin', 'company_admin'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type } = await req.json();
    if (!['check-in', 'check-out'].includes(type)) {
      return NextResponse.json({ error: 'Invalid reminder type. Must be check-in or check-out.' }, { status: 400 });
    }

    await dbConnect();

    // If company admin, only send to their company
    const companyId = role === 'company_admin' ? user.companyId : null;
    const result = await processReminders({ type, companyId });

    return NextResponse.json(
      {
        success: true,
        type,
        message: `${type === 'check-in' ? 'Check-In' : 'Check-Out'} reminders processed for ${result.remindersSent.length} employee(s). Push notifications: ${result.pushCount}.`,
        sentTo: result.remindersSent,
        pushCount: result.pushCount,
        inAppCount: result.inAppCount,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('API Error [Attendance Reminder POST]:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: message }, { status: 500 });
  }
}
