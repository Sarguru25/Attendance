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

    request = await (ModelType as any).findById(id, null, { bypassTenant: true });
    if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    // Permissions check
    const isAdmin = ['admin', 'super_admin', 'company_admin'].includes(session.user.role);
    const approverField = (requestType === 'LEAVE' || requestType === 'PERMISSION') ? request.currentApprover : request.approverId;
    const isApprover = approverField?.toString() === userId;

    if (!isAdmin && !isApprover) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const previousStatus = request.status;
    if (requestType === 'PERMISSION') {
      if (status === 'approved') {
        const PermissionBalance = (await import('@/models/PermissionBalance')).default;
        const permissionDate = new Date(request.date);
        const year = permissionDate.getFullYear();
        const month = permissionDate.getMonth() + 1;

        let balance = await PermissionBalance.findOne({ userId: request.userId, year, month }, null, { bypassTenant: true });
        if (!balance) {
          balance = await PermissionBalance.create({
            companyId: request.companyId,
            userId: request.userId,
            year,
            month,
            allowedMinutes: 120,
            usedMinutes: 0,
            remainingMinutes: 120
          });
        }

        if (request.duration > balance.remainingMinutes) {
          return NextResponse.json({ error: `Insufficient permission balance for employee (${balance.remainingMinutes} mins remaining).` }, { status: 400 });
        }

        request.status = 'Pending Compensation';
        request.pendingMinutes = request.duration;
        request.approvedBy = userId;

        balance.usedMinutes += request.duration;
        balance.remainingMinutes -= request.duration;
        await balance.save({ bypassTenant: true } as any);
      } else {
        request.status = 'Rejected';
        request.approvedBy = userId;
      }
    } else if (requestType === 'LEAVE') {
      const { LeaveBalanceEngine } = await import('@/services/LeaveBalanceEngine');
      const leaveResult = await LeaveBalanceEngine.processLeaveStatusUpdate({
        leaveId: id,
        targetStatus: status,
        approverId: userId
      });
      request = leaveResult.leave;
    } else {
      request.status = status;
      if (status === 'approved' && (requestType === 'MISS_PUNCH' || requestType === 'ATTENDANCE_CORRECTION')) {
        if (finalCheckIn) request.requestedCheckIn = new Date(finalCheckIn);
        if (finalCheckOut) request.requestedCheckOut = new Date(finalCheckOut);
      }
      await request.save({ bypassTenant: true } as any);
    }

    if (requestType === 'PERMISSION') {
      const { recalculateAttendanceForUserAndDate } = await import('@/lib/attendanceUtils');
      await recalculateAttendanceForUserAndDate(request.userId, request.date);
    }

    // If approved, handle side effects
    if (status === 'approved') {
      if (requestType === 'MISS_PUNCH' || requestType === 'ATTENDANCE_CORRECTION') {
        let attendance;

        if (requestType === 'MISS_PUNCH') {
          const d = new Date(request.date);
          const startOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
          const endOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
          attendance = await Attendance.findOne({ userId: request.employeeId, date: { $gte: startOfDay, $lte: endOfDay } }, null, { bypassTenant: true });

          if (!attendance) {
            attendance = new Attendance({
              userId: request.employeeId,
              companyId: request.companyId,
              date: startOfDay,
              status: 'present'
            });
          }
        } else if (requestType === 'ATTENDANCE_CORRECTION') {
          if (request.attendanceId) {
            attendance = await Attendance.findById(request.attendanceId, null, { bypassTenant: true });
          }
          if (!attendance && (request.requestedCheckIn || request.date)) {
            const d = new Date(request.date || request.requestedCheckIn);
            const startOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
            const endOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
            attendance = await Attendance.findOne({ userId: request.employeeId, date: { $gte: startOfDay, $lte: endOfDay } }, null, { bypassTenant: true });
          }
          if (!attendance) {
            const d = new Date(request.date || request.requestedCheckIn || new Date());
            const startOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
            attendance = new Attendance({
              userId: request.employeeId,
              companyId: request.companyId,
              date: startOfDay,
              status: 'present'
            });
          }
        }

        if (attendance) {
          const user = await User.findById(attendance.userId, null, { bypassTenant: true }).populate({ path: 'shiftId', options: { bypassTenant: true } });
          if (!attendance.companyId) {
            attendance.companyId = request.companyId || user?.companyId || (user?.companyIds && user.companyIds[0]);
          }

          if (request.requestedCheckIn) attendance.loginTime = request.requestedCheckIn;
          if (request.requestedCheckOut) attendance.logoutTime = request.requestedCheckOut;
          if (attendance.loginTime) {
            attendance.sessions = [{
              sessionOrder: 1,
              checkIn: attendance.loginTime,
              checkOut: attendance.logoutTime,
              lateMinutes: 0,
              status: attendance.logoutTime ? 'Completed' : 'Pending'
            } as any];
          }

          const Leave = (await import('@/models/Leave')).default;
          const attendanceDate = new Date(attendance.date);
          const startOfDay = new Date(Date.UTC(attendanceDate.getUTCFullYear(), attendanceDate.getUTCMonth(), attendanceDate.getUTCDate(), 0, 0, 0, 0));
          const endOfDay = new Date(Date.UTC(attendanceDate.getUTCFullYear(), attendanceDate.getUTCMonth(), attendanceDate.getUTCDate(), 23, 59, 59, 999));

          const approvedLeaves = await Leave.find({
            userId: attendance.userId,
            status: 'approved',
            fromDate: { $lte: endOfDay },
            toDate: { $gte: startOfDay }
          }, null, { bypassTenant: true }).lean();

          const { calculateDailyAttendance } = await import('@/lib/halfDayUtils');
          const calc = calculateDailyAttendance({
            shift: user?.shiftId,
            date: attendance.date,
            existingAttendance: attendance,
            approvedLeaves
          });

          attendance.firstHalf = calc.firstHalf;
          attendance.secondHalf = calc.secondHalf;
          attendance.status = calc.finalStatus;
          attendance.totalHours = calc.totalWorkedHours;
          attendance.paidLeaveDays = calc.paidLeaveDays;
          attendance.unpaidLeaveDays = calc.unpaidLeaveDays;
          attendance.lateMinutes = calc.lateMinutes;

          attendance.scheduledMinutes = calc.scheduledMinutes;
          attendance.workedMinutes = calc.workedMinutes;
          attendance.totalExtraMinutes = calc.totalExtraMinutes;
          attendance.availableExtraMinutes = calc.availableExtraMinutes;
          attendance.extraBeforeShiftMinutes = calc.extraBeforeShiftMinutes;
          attendance.extraAfterShiftMinutes = calc.extraAfterShiftMinutes;

          await attendance.save({ bypassTenant: true } as any);

          // Handle Comp-Off logic for Miss Punch / Correction approval
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const dayName = dayNames[attendanceDate.getUTCDay()];
          const shift = user?.shiftId as any;
          const isWeeklyOff = shift && Array.isArray(shift.workingDays) && shift.workingDays.length > 0
            ? !shift.workingDays.map((d: string) => d.toLowerCase()).includes(dayName.toLowerCase())
            : attendanceDate.getUTCDay() === 0;

          const Holiday = (await import('@/models/Holiday')).default;
          const holiday = await Holiday.findOne({
            date: { $gte: startOfDay, $lte: endOfDay },
            holidayType: { $in: ['public', 'company'] }
          }, null, { bypassTenant: true });
          const isHoliday = !!holiday;

          if (isWeeklyOff || isHoliday) {
            const CompOffCredit = (await import('@/models/CompOffCredit')).default;
            const existingCredit = await CompOffCredit.findOne({
              $or: [
                { employeeId: attendance.userId },
                { employeeId: attendance.userId.toString() }
              ],
              attendanceDate: { $gte: startOfDay, $lte: endOfDay }
            }, null, { bypassTenant: true });

            const isHalfDay = attendance.status === 'half-day'
              || (attendance.totalHours !== undefined && attendance.totalHours > 0 && attendance.totalHours < 6)
              || (calc.totalWorkedHours !== undefined && calc.totalWorkedHours > 0 && calc.totalWorkedHours < 6)
              || (!attendance.secondHalf?.checkOut || !attendance.firstHalf?.checkOut);

            if (isHalfDay && attendance.status !== 'half-day') {
              attendance.status = 'half-day';
              await attendance.save({ bypassTenant: true } as any);
            }

            const creditAmount = isHalfDay ? 0.5 : 1;

            if (!existingCredit) {
              const expiry = new Date(attendanceDate);
              expiry.setMonth(expiry.getMonth() + 3);
              await CompOffCredit.create({
                employeeId: attendance.userId,
                attendanceDate: startOfDay,
                earnedDate: new Date(),
                availableFromDate: new Date(),
                expiryDate: expiry,
                companyId: user?.companyId,
                credits: creditAmount,
              });

              // Sync leave balance to reflect new comp-off
              const { LeaveBalanceEngine } = await import('@/services/LeaveBalanceEngine');
              await LeaveBalanceEngine.syncLeaveBalance(attendance.userId.toString());
            } else {
              if (existingCredit.credits !== creditAmount) {
                existingCredit.credits = creditAmount;
                await existingCredit.save({ bypassTenant: true } as any);
                const { LeaveBalanceEngine } = await import('@/services/LeaveBalanceEngine');
                await LeaveBalanceEngine.syncLeaveBalance(attendance.userId.toString());
              }
            }
          }
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
