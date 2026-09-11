import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Leave from '@/models/Leave';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const leaves = await Leave.find({ userId: session.user.id }, null, { bypassTenant: true })
      .sort({ createdAt: -1 })
      .lean();

    const { LeaveBalanceEngine } = await import('@/services/LeaveBalanceEngine');
    const balance = await LeaveBalanceEngine.syncLeaveBalance(session.user.id);

    return NextResponse.json({ leaves, balance });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leaveType, fromDate, toDate, reason, attachments } = await req.json();

    if (!leaveType || !fromDate || !toDate || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Calculate number of days (simple version, ignoring weekends/holidays for now, can be enhanced)
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const numberOfDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (numberOfDays <= 0) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
    }

    await dbConnect();

    const { LeaveBalanceEngine } = await import('@/services/LeaveBalanceEngine');
    const eligibility = await LeaveBalanceEngine.checkEligibility(session.user.id, leaveType, numberOfDays);

    if (!eligibility.eligible) {
      return NextResponse.json({ error: eligibility.reason }, { status: 400 });
    }

    if (eligibility.requiresDocument && (!attachments || attachments.length === 0)) {
      return NextResponse.json({ error: 'Supporting documents are required for this leave type.' }, { status: 400 });
    }

    const User = (await import('@/models/User')).default;
    const user = await User.findById(session.user.id, null, { bypassTenant: true });
    let currentApprover = user?.reportsTo;

    if (!currentApprover) {
      const admin = await User.findOne({ role: 'admin' }, null, { bypassTenant: true });
      if (admin) currentApprover = admin._id;
    }

    const leave = await Leave.create({
      userId: session.user.id,
      leaveType,
      fromDate,
      toDate,
      numberOfDays,
      reason,
      attachments,
      status: 'pending',
      currentApprover: undefined,
    });

    const Notification = (await import('@/models/Notification')).default;
    if (currentApprover) {
      await Notification.create({
        recipientId: currentApprover,
        type: 'LEAVE_APPLIED',
        message: `${user?.name || 'An employee'} applied for ${leaveType} leave.`,
        link: '/employee/approvals',
      });
    } else {
      await Notification.create({
        targetRole: 'admin',
        type: 'LEAVE_APPLIED',
        message: `${user?.name || 'An employee'} applied for ${leaveType} leave.`,
        link: '/admin/leaves',
      });
    }

    return NextResponse.json({ message: 'Leave application submitted', leave }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
