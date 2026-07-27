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
    const leave = await Leave.findById(id).populate('userId');
    if (!leave) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    // Check if user is the current approver or an admin
    const currentUser = await User.findById(session.user.id);
    const isAdmin = currentUser?.role === 'admin';
    const isCurrentApprover = leave.currentApprover?.toString() === session.user.id;

    if (!isAdmin && !isCurrentApprover) {
      return NextResponse.json({ error: 'You do not have permission to approve this leave' }, { status: 403 });
    }

    const previousStatus = leave.status;
    leave.status = status;
    leave.approvedBy = session.user.id as any;
    await leave.save();

    if (status === 'approved') {
      const Attendance = (await import('@/models/Attendance')).default;
      
      let currentDate = new Date(leave.fromDate);
      const endDate = new Date(leave.toDate);
      currentDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      while (currentDate <= endDate) {
        const queryDate = new Date(currentDate);
        const nextDay = new Date(queryDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const leaveUser = leave.userId as any;

        const existingAttendance = await Attendance.findOne({
          userId: leaveUser._id,
          date: { $gte: queryDate, $lt: nextDay }
        });

        const newStatus = leave.duration === 'half_day' ? 'half-day' : 'Leave';

        if (existingAttendance) {
          existingAttendance.status = newStatus;
          await existingAttendance.save();
        } else {
          await Attendance.create({
            userId: leaveUser._id,
            companyId: leaveUser.companyId,
            date: queryDate,
            status: newStatus,
            sessions: []
          });
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // Dynamically import ApprovalAuditLog to avoid circular dependencies if any
    const ApprovalAuditLog = (await import('@/models/ApprovalAuditLog')).default;
    await ApprovalAuditLog.create({
      requestId: leave._id,
      requestType: 'LEAVE',
      action: status,
      performedBy: session.user.id,
      oldValue: previousStatus,
      newValue: status
    });

    await Notification.create({
      recipientId: leave.userId._id,
      type: 'LEAVE_UPDATE',
      message: `Your ${leave.leaveType} leave request has been ${status.toLowerCase()}.`,
      link: '/employee/leaves',
    });

    return NextResponse.json({ message: `Leave ${status.toLowerCase()}`, leave });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
