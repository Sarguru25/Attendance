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
    const targetMonth = monthParam ? parseInt(monthParam) : now.getMonth(); // 0-indexed if using JS dates, or 1-indexed? Let's assume 1-12
    const targetYear = yearParam ? parseInt(yearParam) : now.getFullYear();

    // JS Dates are 0-indexed for month
    const startOfMonth = new Date(Date.UTC(targetYear, (monthParam ? targetMonth - 1 : now.getMonth()), 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(targetYear, (monthParam ? targetMonth : now.getMonth() + 1), 0, 23, 59, 59, 999));

    // Fetch Attendance
    const attendances = await Attendance.find({
      userId: employeeId,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    }).sort({ date: -1 }).lean();

    let present = 0, absent = 0, late = 0, halfDay = 0, leaveCount = 0, permissionCount = 0;
    
    attendances.forEach(a => {
      if (a.status === 'present') present++;
      if (a.status === 'late') late++;
      if (a.status === 'absent') absent++;
      if (a.status === 'half-day') halfDay++;
      if (a.status === 'Leave') leaveCount++;
      if (a.status === 'Permission') permissionCount++;
    });

    const attendanceSummary = {
      present,
      absent,
      late,
      halfDay,
      leave: leaveCount,
      permission: permissionCount,
      total: attendances.length
    };

    // Fetch Leaves for the month and all-time leaves history (limited)
    const recentLeaves = await Leave.find({ userId: employeeId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Fetch Permissions for the month
    const recentPermissions = await Permission.find({ userId: employeeId })
      .sort({ date: -1 })
      .limit(10)
      .lean();

    // Fetch leave balance
    const leaveBalance = employee.leaveBalance || null;

    return NextResponse.json({
      employee,
      attendances,
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
