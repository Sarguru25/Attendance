import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Leave from '@/models/Leave';
import Holiday from '@/models/Holiday';
import User from '@/models/User';
import Shift from '@/models/Shift';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const monthStr = searchParams.get('month'); // e.g. "2026-06"
    let targetUserId = searchParams.get('userId') || session.user.id;

    // Only admin can view other people's calendars
    if (!['admin', 'super_admin'].includes(session.user.role) && targetUserId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!monthStr) {
      return NextResponse.json({ error: 'Month parameter is required' }, { status: 400 });
    }

    await dbConnect();

    // Parse the date safely
    const targetDate = parseISO(`${monthStr}-01`);
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: 'Invalid month format' }, { status: 400 });
    }

    const startDate = startOfMonth(targetDate);
    const endDate = endOfMonth(targetDate);

    // Fetch user to verify they exist and get shift
    const user = await User.findById(targetUserId)
      .select('name employeeId joiningDate shiftId')
      .populate('shiftId');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 1. Fetch Attendance
    const attendances = await Attendance.find({
      userId: targetUserId,
      date: { $gte: startDate, $lte: endDate }
    }).lean();

    // 2. Fetch Leaves
    const leaves = await Leave.find({
      userId: targetUserId,
      status: 'approved',
      $or: [
        { fromDate: { $gte: startDate, $lte: endDate } },
        { toDate: { $gte: startDate, $lte: endDate } },
        { fromDate: { $lte: startDate }, toDate: { $gte: endDate } }
      ]
    }).lean();

    // 3. Fetch Holidays
    const holidays = await Holiday.find({
      date: { $gte: startDate, $lte: endDate }
    }).lean();

    return NextResponse.json({ 
      user,
      attendances,
      leaves,
      holidays
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
