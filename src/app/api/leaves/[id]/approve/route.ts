import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Leave from '@/models/Leave';
import User from '@/models/User';
import Notification from '@/models/Notification';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { status } = await req.json(); // "approved" or "rejected"

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    await dbConnect();
    const leave = await Leave.findById(id, null, { bypassTenant: true }).populate({ path: 'userId', options: { bypassTenant: true } });
    if (!leave) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    // Check if user is the current approver or an admin
    const currentUser = await User.findById(session.user.id, null, { bypassTenant: true });
    const isAdmin = currentUser?.role === 'admin';
    const isCurrentApprover = leave.currentApprover?.toString() === session.user.id;

    if (!isAdmin && !isCurrentApprover) {
      return NextResponse.json({ error: 'You do not have permission to approve this leave' }, { status: 403 });
    }

    const { LeaveBalanceEngine } = await import('@/services/LeaveBalanceEngine');
    const result = await LeaveBalanceEngine.processLeaveStatusUpdate({
      leaveId: id,
      targetStatus: status,
      approverId: session.user.id
    });

    const updatedLeave = result.leave;

    // Dynamically import ApprovalAuditLog to avoid circular dependencies if any
    const ApprovalAuditLog = (await import('@/models/ApprovalAuditLog')).default;
    await ApprovalAuditLog.create({
      requestId: updatedLeave._id,
      requestType: 'LEAVE',
      action: status,
      performedBy: session.user.id,
      oldValue: result.previousStatus,
      newValue: status
    });

    const recipientUserId = updatedLeave.userId._id || updatedLeave.userId;
    let leaveDesc = updatedLeave.leaveType;
    if (updatedLeave.duration === 'half_day') {
      leaveDesc = `Half Day (${updatedLeave.halfDaySession === 'first_half' ? 'First Half' : 'Second Half'}) ${updatedLeave.leaveType}`;
    }

    await Notification.create({
      recipientId: recipientUserId,
      type: 'LEAVE_UPDATE',
      message: `Your ${leaveDesc} request has been ${status.toLowerCase()}.`,
      link: '/employee/leaves',
    });

    return NextResponse.json({ message: `Leave ${status.toLowerCase()}`, leave: updatedLeave });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
