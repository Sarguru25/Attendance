import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Leave from '@/models/Leave';
import Holiday from '@/models/Holiday';
import User from '@/models/User';
import Shift from '@/models/Shift';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const monthStr = searchParams.get('month'); // e.g. "2026-06"

    if (!monthStr) {
      return NextResponse.json({ error: 'Month parameter is required' }, { status: 400 });
    }

    await dbConnect();

    const targetDate = parseISO(`${monthStr}-01`);
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: 'Invalid month format' }, { status: 400 });
    }

    const startDate = startOfMonth(targetDate);
    const endDate = endOfMonth(targetDate);

    // Fetch all users
    const users = await User.find({ 
      role: { $ne: 'super_admin' },
      name: { $ne: 'Super Admin' }
    }).select('name employeeId joiningDate shiftId').populate('shiftId').lean();

    // Fetch Attendance
    const attendances = await Attendance.find({
      date: { $gte: startDate, $lte: endDate }
    }).lean();

    // Fetch Leaves
    const leaves = await Leave.find({
      status: 'approved',
      $or: [
        { fromDate: { $gte: startDate, $lte: endDate } },
        { toDate: { $gte: startDate, $lte: endDate } },
        { fromDate: { $lte: startDate }, toDate: { $gte: endDate } }
      ]
    }).lean();

    // Fetch Holidays
    const holidays = await Holiday.find({
      date: { $gte: startDate, $lte: endDate }
    }).lean();

    return NextResponse.json({ 
      users,
      attendances,
      leaves,
      holidays
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
