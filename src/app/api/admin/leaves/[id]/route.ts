import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Leave from '@/models/Leave';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { status } = await req.json();

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    await dbConnect();
    const { LeaveBalanceEngine } = await import('@/services/LeaveBalanceEngine');
    const result = await LeaveBalanceEngine.processLeaveStatusUpdate({
      leaveId: id,
      targetStatus: status,
      approverId: session.user.id
    });

    const leave = result.leave;

    // Dynamically import ApprovalAuditLog to avoid circular dependencies if any
    const ApprovalAuditLog = (await import('@/models/ApprovalAuditLog')).default;
    await ApprovalAuditLog.create({
      requestId: leave._id,
      requestType: 'LEAVE',
      action: status,
      performedBy: session.user.id,
      oldValue: result.previousStatus,
      newValue: status
    });

    if (status !== 'pending') {
      const Notification = (await import('@/models/Notification')).default;
      let leaveDesc = leave.leaveType;
      if (leave.duration === 'half_day') {
        leaveDesc = `Half Day (${leave.halfDaySession === 'first_half' ? 'First Half' : 'Second Half'}) ${leave.leaveType}`;
      }

      await Notification.create({
        recipientId: leave.userId,
        type: 'LEAVE_UPDATE',
        message: `Your ${leaveDesc} request has been ${status}.`,
        link: '/employee/leaves',
      });
    }

    return NextResponse.json({ message: 'Leave status updated', leave });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
