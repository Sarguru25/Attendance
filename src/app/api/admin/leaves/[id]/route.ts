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
    const leave = await Leave.findByIdAndUpdate(
      id,
      { status, approvedBy: session.user.id },
      { new: true }
    );

    if (!leave) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    if (leave) {
      const { syncLeaveToAttendance } = await import('@/lib/halfDayUtils');
      await syncLeaveToAttendance(leave, status === 'approved');
    }

    if (status === 'approved') {
      const { LeaveBalanceEngine } = await import('@/services/LeaveBalanceEngine');
      await LeaveBalanceEngine.syncLeaveBalance(leave.userId.toString());
      const User = (await import('@/models/User')).default;
      const user = await User.findById(leave.userId);

      if (user && user.leaveBalance) {
        if (leave.leaveType === 'Casual Leave') {
          user.leaveBalance.casualLeave.taken += leave.numberOfDays;
          user.leaveBalance.casualLeave.available -= leave.numberOfDays;
        } else if (leave.leaveType === 'Sick Leave') {
          user.leaveBalance.sickLeave.taken += leave.numberOfDays;
          user.leaveBalance.sickLeave.available -= leave.numberOfDays;
        } else if (leave.leaveType === 'Restricted Holiday') {
          user.leaveBalance.restrictedLeave.taken += leave.numberOfDays;
          user.leaveBalance.restrictedLeave.available -= leave.numberOfDays;
        } else if (leave.leaveType === 'Maternity Leave') {
          user.leaveBalance.maternityLeave.taken += leave.numberOfDays;
          user.leaveBalance.maternityLeave.available -= leave.numberOfDays;
        } else if (leave.leaveType === 'Paternity Leave') {
          user.leaveBalance.paternityLeave.taken += leave.numberOfDays;
          user.leaveBalance.paternityLeave.available -= leave.numberOfDays;
        } else if (leave.leaveType === 'Leave Without Pay') {
          user.leaveBalance.leaveWithoutPay.taken += leave.numberOfDays;
        } else if (leave.leaveType === 'Compensatory Off') {
          const CompOffCredit = (await import('@/models/CompOffCredit')).default;
          const credits = await CompOffCredit.find({
            $or: [
              { employeeId: leave.userId },
              { employeeId: leave.userId.toString() }
            ],
            isUsed: false
          }).sort({ earnedDate: 1 });

          let needed = leave.numberOfDays;
          for (const credit of credits) {
            if (needed <= 0) break;
            const cVal = credit.credits !== undefined ? credit.credits : 1;
            if (cVal <= needed) {
              credit.isUsed = true;
              credit.usedAgainstLeave = leave._id;
              await credit.save();
              needed = Math.round((needed - cVal) * 100) / 100;
            } else {
              credit.credits = Math.round((cVal - needed) * 100) / 100;
              await credit.save();
              await CompOffCredit.create({
                employeeId: credit.employeeId,
                companyId: credit.companyId,
                attendanceDate: credit.attendanceDate,
                earnedDate: credit.earnedDate,
                availableFromDate: credit.availableFromDate,
                expiryDate: credit.expiryDate,
                isUsed: true,
                credits: needed,
                usedAgainstLeave: leave._id,
              });
              needed = 0;
            }
          }
          user.leaveBalance.compensatoryOff.taken = (user.leaveBalance.compensatoryOff.taken || 0) + leave.numberOfDays;
          user.leaveBalance.compensatoryOff.available = Math.max(0, (user.leaveBalance.compensatoryOff.available || 0) - leave.numberOfDays);
        }
        user.markModified('leaveBalance');
        await user.save();
      }
    }

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
