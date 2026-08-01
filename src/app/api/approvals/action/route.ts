import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Leave from '@/models/Leave';
import MissPunch from '@/models/MissPunch';
import AttendanceCorrection from '@/models/AttendanceCorrection';
import OvertimeRequest from '@/models/OvertimeRequest';
import WFHRequest from '@/models/WFHRequest';
import ApprovalAuditLog from '@/models/ApprovalAuditLog';
import Notification from '@/models/Notification';
import Permission from '@/models/Permission';
import Attendance from '@/models/Attendance';
import User from '@/models/User';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, requestType, status, finalCheckIn, finalCheckOut } = await req.json(); // status = approved | rejected
    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    await dbConnect();
    const userId = session.user.id;

    let request;
    let employeeId;
    let ModelType;

    switch (requestType) {
      case 'LEAVE': ModelType = Leave; break;
      case 'MISS_PUNCH': ModelType = MissPunch; break;
      case 'ATTENDANCE_CORRECTION': ModelType = AttendanceCorrection; break;
      case 'OVERTIME': ModelType = OvertimeRequest; break;
      case 'WFH': ModelType = WFHRequest; break;
      case 'PERMISSION': ModelType = Permission; break;
      default: return NextResponse.json({ error: 'Invalid requestType' }, { status: 400 });
    }

    request = await (ModelType as any).findById(id);
    if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    // Permissions check
    const isAdmin = ['admin', 'super_admin', 'company_admin'].includes(session.user.role);
    const approverField = (requestType === 'LEAVE' || requestType === 'PERMISSION') ? request.currentApprover : request.approverId;
    const isApprover = approverField?.toString() === userId;

    if (!isAdmin && !isApprover) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const previousStatus = request.status;
    request.status = requestType === 'PERMISSION' ? (status === 'approved' ? 'Approved' : 'Rejected') : status;

    if (requestType === 'LEAVE' || requestType === 'PERMISSION') {
      request.approvedBy = userId;
    } else if (status === 'approved' && (requestType === 'MISS_PUNCH' || requestType === 'ATTENDANCE_CORRECTION')) {
      if (finalCheckIn) request.requestedCheckIn = new Date(finalCheckIn);
      if (finalCheckOut) request.requestedCheckOut = new Date(finalCheckOut);
    }

    await request.save();

    // If approved, handle side effects
    if (status === 'approved') {
      if (requestType === 'LEAVE') {
        const { LeaveBalanceEngine } = await import('@/services/LeaveBalanceEngine');
        await LeaveBalanceEngine.syncLeaveBalance(request.userId.toString());
        const user = await User.findById(request.userId);

        if (user && user.leaveBalance) {
          if (request.leaveType === 'Casual Leave') {
            user.leaveBalance.casualLeave.taken += request.numberOfDays;
            user.leaveBalance.casualLeave.available -= request.numberOfDays;
          } else if (request.leaveType === 'Sick Leave') {
            user.leaveBalance.sickLeave.taken += request.numberOfDays;
            user.leaveBalance.sickLeave.available -= request.numberOfDays;
          } else if (request.leaveType === 'Restricted Holiday') {
            user.leaveBalance.restrictedLeave.taken += request.numberOfDays;
            user.leaveBalance.restrictedLeave.available -= request.numberOfDays;
          } else if (request.leaveType === 'Maternity Leave') {
            user.leaveBalance.maternityLeave.taken += request.numberOfDays;
            user.leaveBalance.maternityLeave.available -= request.numberOfDays;
          } else if (request.leaveType === 'Paternity Leave') {
            user.leaveBalance.paternityLeave.taken += request.numberOfDays;
            user.leaveBalance.paternityLeave.available -= request.numberOfDays;
          } else if (request.leaveType === 'Leave Without Pay') {
            user.leaveBalance.leaveWithoutPay.taken += request.numberOfDays;
          } else if (request.leaveType === 'Compensatory Off') {
            const CompOffCredit = (await import('@/models/CompOffCredit')).default;
            const credits = await CompOffCredit.find({
              employeeId: request.userId,
              isUsed: false
            }).sort({ earnedDate: 1 }).limit(request.numberOfDays);

            for (const credit of credits) {
              credit.isUsed = true;
              credit.usedAgainstLeave = request._id;
              await credit.save();
            }
            user.leaveBalance.compensatoryOff.taken += credits.length;
            user.leaveBalance.compensatoryOff.available -= credits.length;
          }
          user.markModified('leaveBalance');
          await user.save();
          
          // Update Attendance records for the leave duration
          const fromDate = new Date(request.fromDate);
          const toDate = new Date(request.toDate);
          fromDate.setUTCHours(0, 0, 0, 0);
          toDate.setUTCHours(23, 59, 59, 999);
          
          let currentDate = new Date(fromDate);
          while (currentDate <= toDate) {
            const startOfDay = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate(), 0, 0, 0, 0));
            const endOfDay = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate(), 23, 59, 59, 999));
            
            let attStatus = request.duration === 'half_day' || request.numberOfDays === 0.5 ? 'half-day' : 'Leave';
            
            await Attendance.findOneAndUpdate(
              { userId: request.userId, date: { $gte: startOfDay, $lte: endOfDay } },
              { 
                $set: { 
                  status: attStatus,
                  date: startOfDay,
                  userId: request.userId,
                  companyId: user?.companyId
                } 
              },
              { upsert: true, new: true }
            );
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
          }
        }
      } else if (requestType === 'MISS_PUNCH' || requestType === 'ATTENDANCE_CORRECTION') {
        let attendance;
        
        if (requestType === 'MISS_PUNCH') {
          const d = new Date(request.date);
          const startOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
          const endOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
          attendance = await Attendance.findOne({ userId: request.employeeId, date: { $gte: startOfDay, $lte: endOfDay } });
          
          if (!attendance) {
            attendance = new Attendance({
              userId: request.employeeId,
              date: request.date,
              status: 'present'
            });
          }
        } else if (requestType === 'ATTENDANCE_CORRECTION') {
          attendance = await Attendance.findById(request.attendanceId);
        }

        if (attendance) {
          if (request.requestedCheckIn) attendance.loginTime = request.requestedCheckIn;
          if (request.requestedCheckOut) attendance.logoutTime = request.requestedCheckOut;
          
          if (attendance.loginTime && attendance.logoutTime) {
            attendance.totalHours = (new Date(attendance.logoutTime).getTime() - new Date(attendance.loginTime).getTime()) / (1000 * 60 * 60);
          }

          attendance.status = 'present';
          attendance.lateMinutes = 0;
          
          const user = await User.findById(attendance.userId).populate('shiftId');
          if (attendance.loginTime && user?.shiftId && (user.shiftId as any).sessions?.length > 0) {
             const shiftFirstSession = (user.shiftId as any).sessions.sort((a: any, b: any) => a.order - b.order)[0];
             const [startH, startM] = shiftFirstSession.startTime.split(':').map(Number);
             const graceTime = shiftFirstSession.graceTime || 0;
             const shiftStartMinutes = startH * 60 + startM;
             
             const loginTimeStr = new Date(attendance.loginTime).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
             const [loginH, loginM] = loginTimeStr.split(':').map(Number);
             const loginMinutes = loginH * 60 + loginM;
             
             if (loginMinutes > shiftStartMinutes + graceTime) {
               attendance.status = 'late';
               attendance.lateMinutes = loginMinutes - shiftStartMinutes;
             }
          }
          
          if (requestType === 'ATTENDANCE_CORRECTION') {
             attendance.correctionStatus = 'approved';
          }
          await attendance.save();
        }
      }
    }

    employeeId = (requestType === 'LEAVE' || requestType === 'PERMISSION') ? request.userId : request.employeeId;

    await ApprovalAuditLog.create({
      requestId: request._id,
      requestType,
      action: status,
      performedBy: userId,
      oldValue: previousStatus,
      newValue: status
    });

    let message = `Your ${requestType.replace('_', ' ').toLowerCase()} request has been ${status.toLowerCase()}.`;
    if (requestType === 'LEAVE' && request.duration === 'half_day') {
      message = `Your Half Day (${request.halfDaySession === 'first_half' ? 'First Half' : 'Second Half'}) ${request.leaveType} request has been ${status.toLowerCase()}.`;
    } else if (requestType === 'LEAVE') {
      message = `Your ${request.leaveType} request has been ${status.toLowerCase()}.`;
    }

    await Notification.create({
      recipientId: employeeId,
      type: `${requestType}_UPDATE`,
      message,
      link: `/employee/dashboard`,
    });

    return NextResponse.json({ message: `Request ${status.toLowerCase()} successfully`, request });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
