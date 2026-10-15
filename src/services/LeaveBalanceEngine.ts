import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import CompOffCredit from '@/models/CompOffCredit';

export class LeaveBalanceEngine {
  
  static getFinancialYear(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed (0 = Jan, 3 = Apr)
    if (month >= 3) { // April or later
      return `${year}-${(year + 1).toString().slice(-2)}`;
    } else { // Jan-March
      return `${year - 1}-${year.toString().slice(-2)}`;
    }
  }

  static async syncLeaveBalance(employeeId: string) {
    await dbConnect();
    const user = await User.findById(employeeId, null, { bypassTenant: true });
    if (!user) throw new Error('User not found');

    const doj = user.joiningDate ? new Date(user.joiningDate) : new Date();
    const now = new Date();
    const monthsOfService = (now.getFullYear() - doj.getFullYear()) * 12 + (now.getMonth() - doj.getMonth());
    const isEligibleForCL = monthsOfService >= 6;

    let needsUpdate = false;

    // Ensure leaveBalance exists
    if (!user.leaveBalance) {
      user.leaveBalance = {
        sickLeave: { total: 12, available: 12, taken: 0, withoutCertificate: { limit: 4, used: 0 }, withCertificate: { limit: 8, used: 0 } },
        casualLeave: { total: 0, available: 0, taken: 0, carryForward: 0 },
        compensatoryOff: { total: 0, available: 0, taken: 0, earned: 0 },
        restrictedLeave: { total: 2, available: 2, taken: 0 },
        maternityLeave: { total: user.gender === 'female' ? 60 : 0, available: user.gender === 'female' ? 60 : 0, taken: 0 },
        paternityLeave: { total: user.gender === 'male' ? 2 : 0, available: user.gender === 'male' ? 2 : 0, taken: 0 },
        leaveWithoutPay: { taken: 0 }
      };
      needsUpdate = true;
    }

    // Defensive check: ensure all sub-categories exist
    if (!user.leaveBalance.casualLeave) {
      user.leaveBalance.casualLeave = { total: 0, available: 0, taken: 0, carryForward: 0 };
      needsUpdate = true;
    }
    if (!user.leaveBalance.sickLeave) {
      user.leaveBalance.sickLeave = { total: 12, available: 12, taken: 0, withoutCertificate: { limit: 4, used: 0 }, withCertificate: { limit: 8, used: 0 } };
      needsUpdate = true;
    }
    if (!user.leaveBalance.sickLeave.withoutCertificate) {
      user.leaveBalance.sickLeave.withoutCertificate = { limit: 4, used: 0 };
      needsUpdate = true;
    }
    if (!user.leaveBalance.sickLeave.withCertificate) {
      user.leaveBalance.sickLeave.withCertificate = { limit: 8, used: 0 };
      needsUpdate = true;
    }
    if (!user.leaveBalance.restrictedLeave) {
      user.leaveBalance.restrictedLeave = { total: 2, available: 2, taken: 0 };
      needsUpdate = true;
    }
    if (!user.leaveBalance.compensatoryOff) {
      user.leaveBalance.compensatoryOff = { total: 0, available: 0, taken: 0, earned: 0 };
      needsUpdate = true;
    }
    if (!user.leaveBalance.maternityLeave) {
      user.leaveBalance.maternityLeave = { total: user.gender === 'female' ? 60 : 0, available: user.gender === 'female' ? 60 : 0, taken: 0 };
      needsUpdate = true;
    }
    if (!user.leaveBalance.paternityLeave) {
      user.leaveBalance.paternityLeave = { total: user.gender === 'male' ? 2 : 0, available: user.gender === 'male' ? 2 : 0, taken: 0 };
      needsUpdate = true;
    }
    if (!user.leaveBalance.leaveWithoutPay) {
      user.leaveBalance.leaveWithoutPay = { taken: 0 };
      needsUpdate = true;
    }

    // Sync gender-based leaves in case gender was updated
    if (user.gender === 'male' && (user.leaveBalance.paternityLeave.total === 0 || !user.leaveBalance.paternityLeave.total)) {
      user.leaveBalance.paternityLeave.total = 2;
      user.leaveBalance.paternityLeave.available = Math.max(0, 2 - (user.leaveBalance.paternityLeave.taken || 0));
      needsUpdate = true;
    }
    if (user.gender === 'female' && (user.leaveBalance.maternityLeave.total === 0 || !user.leaveBalance.maternityLeave.total)) {
      user.leaveBalance.maternityLeave.total = 60;
      user.leaveBalance.maternityLeave.available = Math.max(0, 60 - (user.leaveBalance.maternityLeave.taken || 0));
      needsUpdate = true;
    }

    // CL Increment logic
    if (isEligibleForCL) {
      const completedYears = Math.floor(monthsOfService / 12);
      const expectedCLTotal = Math.min(10 + completedYears, 14);
      
      if (user.leaveBalance.casualLeave.total < expectedCLTotal) {
        const increment = expectedCLTotal - Math.max(10, user.leaveBalance.casualLeave.total);
        if (increment > 0 || user.leaveBalance.casualLeave.total === 0) {
          // Initialize or increment
          const newTotal = user.leaveBalance.casualLeave.total === 0 ? 10 : user.leaveBalance.casualLeave.total + increment;
          user.leaveBalance.casualLeave.total = newTotal;
          // When total increases, available should also increase
          if (user.leaveBalance.casualLeave.total === 10) {
            // First time allocation
            user.leaveBalance.casualLeave.available = (user.leaveBalance.casualLeave.available || 0) + 10;
          } else {
            user.leaveBalance.casualLeave.available = (user.leaveBalance.casualLeave.available || 0) + increment;
          }
          needsUpdate = true;
        }
      }
    }

    // Recalculate CompOff available from CompOffCredit model
    const employeeObjId = mongoose.Types.ObjectId.isValid(employeeId)
      ? new mongoose.Types.ObjectId(employeeId)
      : employeeId;

    const compOffs = await CompOffCredit.find({
      $or: [
        { employeeId: employeeObjId },
        { employeeId: employeeId.toString() }
      ],
      isUsed: false,
    }, null, { bypassTenant: true });

    const earned = compOffs.reduce((sum, c) => sum + (c.credits !== undefined ? c.credits : 1), 0);
    const currentAvailable = user.leaveBalance.compensatoryOff.available || 0;

    if (compOffs.length === 0 && currentAvailable > 0) {
      // Legacy user has available balance but no CompOffCredit records existed yet.
      // Backfill once so their legacy balance isn't lost.
      let remaining = Math.round(currentAvailable * 100) / 100;
      const nowTime = new Date();
      const backfill = [];
      while (remaining > 0) {
        const creditAmount = remaining >= 1 ? 1 : remaining;
        backfill.push({
          employeeId: employeeObjId,
          companyId: user.companyId || (user.companyIds && user.companyIds[0]) || undefined,
          attendanceDate: nowTime,
          earnedDate: nowTime,
          availableFromDate: nowTime,
          credits: creditAmount,
          isUsed: false,
        });
        remaining = Math.round((remaining - creditAmount) * 100) / 100;
      }
      if (backfill.length > 0) {
        await CompOffCredit.insertMany(backfill);
      }
      user.leaveBalance.compensatoryOff.total = currentAvailable + (user.leaveBalance.compensatoryOff.taken || 0);
      user.leaveBalance.compensatoryOff.earned = user.leaveBalance.compensatoryOff.total;
      needsUpdate = true;
    } else if (user.leaveBalance.compensatoryOff.available !== earned) {
      user.leaveBalance.compensatoryOff.available = earned;
      user.leaveBalance.compensatoryOff.total = earned + (user.leaveBalance.compensatoryOff.taken || 0);
      user.leaveBalance.compensatoryOff.earned = user.leaveBalance.compensatoryOff.total;
      needsUpdate = true;
    } else {
      // Ensure total and earned stay consistent with taken + available
      const expectedTotal = currentAvailable + (user.leaveBalance.compensatoryOff.taken || 0);
      if (user.leaveBalance.compensatoryOff.total !== expectedTotal) {
        user.leaveBalance.compensatoryOff.total = expectedTotal;
        user.leaveBalance.compensatoryOff.earned = expectedTotal;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      user.markModified('leaveBalance');
      await user.save({ bypassTenant: true } as any);
    }

    return user.leaveBalance;
  }

  static async checkEligibility(employeeId: string, leaveType: string, numberOfDays: number, includePending: boolean = true): Promise<{ eligible: boolean, reason?: string, requiresDocument?: boolean }> {
    const balance = await this.syncLeaveBalance(employeeId);

    let pendingDays = 0;
    if (includePending) {
      const Leave = (await import('@/models/Leave')).default;
      const queryType = (leaveType === 'Restricted Holiday' || leaveType === 'Restricted Leave')
        ? { $in: ['Restricted Holiday', 'Restricted Leave'] }
        : leaveType;

      const pendingLeaves = await Leave.find({
        userId: employeeId,
        leaveType: queryType,
        status: 'pending'
      }, null, { bypassTenant: true });
      pendingDays = pendingLeaves.reduce((sum: number, l: any) => sum + (l.numberOfDays || 0), 0);
    }

    if (leaveType === 'Casual Leave') {
      if (balance.casualLeave.total === 0) {
        return { eligible: false, reason: 'You must complete 6 months of service to be eligible for Casual Leave.' };
      }
      const available = Math.max(0, (balance.casualLeave.available || 0) - pendingDays);
      if (available < numberOfDays) {
        return {
          eligible: false,
          reason: pendingDays > 0
            ? `Insufficient Casual Leave balance. You have ${balance.casualLeave.available} days left (${pendingDays} day(s) pending approval).`
            : `Insufficient Casual Leave balance. You have ${balance.casualLeave.available} days left.`
        };
      }
      return { eligible: true };
    }

    if (leaveType === 'Sick Leave') {
      const available = Math.max(0, (balance.sickLeave.available || 0) - pendingDays);
      if (available < numberOfDays) {
        return {
          eligible: false,
          reason: pendingDays > 0
            ? `Insufficient Sick Leave balance. You have ${balance.sickLeave.available} days left (${pendingDays} day(s) pending approval).`
            : `Insufficient Sick Leave balance. You have ${balance.sickLeave.available} days left.`
        };
      }
      
      // Check document requirement
      // Rule: first 4 days without cert.
      const withoutCertUsed = balance.sickLeave.withoutCertificate?.used || 0;
      const wouldBeUsedWithoutCert = withoutCertUsed + pendingDays + numberOfDays;
      if (wouldBeUsedWithoutCert > 4) {
        return { eligible: true, requiresDocument: true };
      }
      return { eligible: true };
    }

    if (leaveType === 'Restricted Holiday' || leaveType === 'Restricted Leave') {
      const available = Math.max(0, (balance.restrictedLeave.available || 0) - pendingDays);
      if (available < numberOfDays) {
        return { eligible: false, reason: 'Restricted Holiday quota exceeded. Maximum 2 allowed per year.' };
      }
      return { eligible: true };
    }

    if (leaveType === 'Compensatory Off') {
      const available = Math.max(0, (balance.compensatoryOff.available || 0) - pendingDays);
      if (available < numberOfDays) {
        return {
          eligible: false,
          reason: pendingDays > 0
            ? `Insufficient Comp-Off balance. You have ${balance.compensatoryOff.available} day(s) available (${pendingDays} day(s) pending approval).`
            : `Insufficient Comp-Off balance. You have ${balance.compensatoryOff.available} days available.`
        };
      }
      return { eligible: true };
    }

    if (leaveType === 'Maternity Leave') {
      if (balance.maternityLeave.total === 0) {
        return { eligible: false, reason: 'Maternity leave is only applicable for female employees.' };
      }
      const available = Math.max(0, (balance.maternityLeave.available || 0) - pendingDays);
      if (available < numberOfDays) {
        return { eligible: false, reason: `Insufficient Maternity Leave balance. You have ${balance.maternityLeave.available} days left.` };
      }
      return { eligible: true }; 
    }

    if (leaveType === 'Paternity Leave') {
      if (balance.paternityLeave.total === 0) {
        return { eligible: false, reason: 'Paternity leave is only applicable for male employees.' };
      }
      const available = Math.max(0, (balance.paternityLeave.available || 0) - pendingDays);
      if (available < numberOfDays) {
        return { eligible: false, reason: `Insufficient Paternity Leave balance. You have ${balance.paternityLeave.available} days left.` };
      }
      return { eligible: true }; 
    }

    if (leaveType === 'Leave Without Pay') {
      return { eligible: true };
    }

    return { eligible: false, reason: 'Invalid leave type.' };
  }

  /**
   * Deducts leave days from available and adds to taken in User.leaveBalance.
   */
  static async deductBalanceForLeave(user: any, leave: any, days: number) {
    if (!user.leaveBalance) return;
    const leaveType = (leave.leaveType || '').trim();

    if (leaveType === 'Casual Leave') {
      user.leaveBalance.casualLeave.taken = Math.round(((user.leaveBalance.casualLeave.taken || 0) + days) * 100) / 100;
      user.leaveBalance.casualLeave.available = Math.max(0, Math.round(((user.leaveBalance.casualLeave.available || 0) - days) * 100) / 100);
    } else if (leaveType === 'Sick Leave') {
      user.leaveBalance.sickLeave.taken = Math.round(((user.leaveBalance.sickLeave.taken || 0) + days) * 100) / 100;
      user.leaveBalance.sickLeave.available = Math.max(0, Math.round(((user.leaveBalance.sickLeave.available || 0) - days) * 100) / 100);

      if (!user.leaveBalance.sickLeave.withoutCertificate) user.leaveBalance.sickLeave.withoutCertificate = { limit: 4, used: 0 };
      if (!user.leaveBalance.sickLeave.withCertificate) user.leaveBalance.sickLeave.withCertificate = { limit: 8, used: 0 };

      const hasAttachment = Array.isArray(leave.attachments) && leave.attachments.length > 0;
      if (hasAttachment) {
        user.leaveBalance.sickLeave.withCertificate.used = Math.round(((user.leaveBalance.sickLeave.withCertificate.used || 0) + days) * 100) / 100;
      } else {
        user.leaveBalance.sickLeave.withoutCertificate.used = Math.round(((user.leaveBalance.sickLeave.withoutCertificate.used || 0) + days) * 100) / 100;
      }
    } else if (leaveType === 'Restricted Holiday' || leaveType === 'Restricted Leave') {
      user.leaveBalance.restrictedLeave.taken = Math.round(((user.leaveBalance.restrictedLeave.taken || 0) + days) * 100) / 100;
      user.leaveBalance.restrictedLeave.available = Math.max(0, Math.round(((user.leaveBalance.restrictedLeave.available || 0) - days) * 100) / 100);
    } else if (leaveType === 'Compensatory Off') {
      const CompOffCredit = (await import('@/models/CompOffCredit')).default;
      const credits = await CompOffCredit.find({
        $or: [
          { employeeId: leave.userId },
          { employeeId: leave.userId.toString() }
        ],
        isUsed: false
      }, null, { bypassTenant: true }).sort({ earnedDate: 1 });

      let needed = days;
      for (const credit of credits) {
        if (needed <= 0) break;
        const cVal = credit.credits !== undefined ? credit.credits : 1;
        if (cVal <= needed) {
          credit.isUsed = true;
          credit.usedAgainstLeave = leave._id;
          await credit.save({ bypassTenant: true } as any);
          needed = Math.round((needed - cVal) * 100) / 100;
        } else {
          credit.credits = Math.round((cVal - needed) * 100) / 100;
          await credit.save({ bypassTenant: true } as any);
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
      user.leaveBalance.compensatoryOff.taken = Math.round(((user.leaveBalance.compensatoryOff.taken || 0) + days) * 100) / 100;
      user.leaveBalance.compensatoryOff.available = Math.max(0, Math.round(((user.leaveBalance.compensatoryOff.available || 0) - days) * 100) / 100);
    } else if (leaveType === 'Maternity Leave') {
      user.leaveBalance.maternityLeave.taken = Math.round(((user.leaveBalance.maternityLeave.taken || 0) + days) * 100) / 100;
      user.leaveBalance.maternityLeave.available = Math.max(0, Math.round(((user.leaveBalance.maternityLeave.available || 0) - days) * 100) / 100);
    } else if (leaveType === 'Paternity Leave') {
      user.leaveBalance.paternityLeave.taken = Math.round(((user.leaveBalance.paternityLeave.taken || 0) + days) * 100) / 100;
      user.leaveBalance.paternityLeave.available = Math.max(0, Math.round(((user.leaveBalance.paternityLeave.available || 0) - days) * 100) / 100);
    } else if (leaveType === 'Leave Without Pay') {
      if (!user.leaveBalance.leaveWithoutPay) user.leaveBalance.leaveWithoutPay = { taken: 0 };
      user.leaveBalance.leaveWithoutPay.taken = Math.round(((user.leaveBalance.leaveWithoutPay.taken || 0) + days) * 100) / 100;
    }
  }

  /**
   * Restores leave days back to available and subtracts from taken in User.leaveBalance.
   */
  static async refundBalanceForLeave(user: any, leave: any, days: number) {
    if (!user.leaveBalance) return;
    const leaveType = (leave.leaveType || '').trim();

    if (leaveType === 'Casual Leave') {
      user.leaveBalance.casualLeave.taken = Math.max(0, Math.round(((user.leaveBalance.casualLeave.taken || 0) - days) * 100) / 100);
      user.leaveBalance.casualLeave.available = Math.round(((user.leaveBalance.casualLeave.available || 0) + days) * 100) / 100;
    } else if (leaveType === 'Sick Leave') {
      user.leaveBalance.sickLeave.taken = Math.max(0, Math.round(((user.leaveBalance.sickLeave.taken || 0) - days) * 100) / 100);
      user.leaveBalance.sickLeave.available = Math.round(((user.leaveBalance.sickLeave.available || 0) + days) * 100) / 100;

      if (!user.leaveBalance.sickLeave.withoutCertificate) user.leaveBalance.sickLeave.withoutCertificate = { limit: 4, used: 0 };
      if (!user.leaveBalance.sickLeave.withCertificate) user.leaveBalance.sickLeave.withCertificate = { limit: 8, used: 0 };

      const hasAttachment = Array.isArray(leave.attachments) && leave.attachments.length > 0;
      if (hasAttachment) {
        user.leaveBalance.sickLeave.withCertificate.used = Math.max(0, Math.round(((user.leaveBalance.sickLeave.withCertificate.used || 0) - days) * 100) / 100);
      } else {
        user.leaveBalance.sickLeave.withoutCertificate.used = Math.max(0, Math.round(((user.leaveBalance.sickLeave.withoutCertificate.used || 0) - days) * 100) / 100);
      }
    } else if (leaveType === 'Restricted Holiday' || leaveType === 'Restricted Leave') {
      user.leaveBalance.restrictedLeave.taken = Math.max(0, Math.round(((user.leaveBalance.restrictedLeave.taken || 0) - days) * 100) / 100);
      user.leaveBalance.restrictedLeave.available = Math.round(((user.leaveBalance.restrictedLeave.available || 0) + days) * 100) / 100;
    } else if (leaveType === 'Compensatory Off') {
      const CompOffCredit = (await import('@/models/CompOffCredit')).default;
      await CompOffCredit.updateMany(
        { usedAgainstLeave: leave._id },
        { $set: { isUsed: false }, $unset: { usedAgainstLeave: 1 } }
      );
      user.leaveBalance.compensatoryOff.taken = Math.max(0, Math.round(((user.leaveBalance.compensatoryOff.taken || 0) - days) * 100) / 100);
      user.leaveBalance.compensatoryOff.available = Math.round(((user.leaveBalance.compensatoryOff.available || 0) + days) * 100) / 100;
    } else if (leaveType === 'Maternity Leave') {
      user.leaveBalance.maternityLeave.taken = Math.max(0, Math.round(((user.leaveBalance.maternityLeave.taken || 0) - days) * 100) / 100);
      user.leaveBalance.maternityLeave.available = Math.round(((user.leaveBalance.maternityLeave.available || 0) + days) * 100) / 100;
    } else if (leaveType === 'Paternity Leave') {
      user.leaveBalance.paternityLeave.taken = Math.max(0, Math.round(((user.leaveBalance.paternityLeave.taken || 0) - days) * 100) / 100);
      user.leaveBalance.paternityLeave.available = Math.round(((user.leaveBalance.paternityLeave.available || 0) + days) * 100) / 100;
    } else if (leaveType === 'Leave Without Pay') {
      if (!user.leaveBalance.leaveWithoutPay) user.leaveBalance.leaveWithoutPay = { taken: 0 };
      user.leaveBalance.leaveWithoutPay.taken = Math.max(0, Math.round(((user.leaveBalance.leaveWithoutPay.taken || 0) - days) * 100) / 100);
    }
  }

  /**
   * Cleans up or recalculates Attendance records when an approved leave is reverted.
   */
  static async removeLeaveFromAttendance(leave: any) {
    const Attendance = (await import('@/models/Attendance')).default;
    const { recalculateAttendanceForUserAndDate } = await import('@/lib/attendanceUtils');

    const startDate = new Date(leave.fromDate);
    const endDate = new Date(leave.toDate);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const startOfDay = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999));

      const attendance = await Attendance.findOne({
        userId: leave.userId,
        date: { $gte: startOfDay, $lte: endOfDay }
      }, null, { bypassTenant: true });

      if (attendance) {
        const leaveIdStr = leave._id.toString();
        const fhMatches = attendance.firstHalf?.leaveId?.toString() === leaveIdStr;
        const shMatches = attendance.secondHalf?.leaveId?.toString() === leaveIdStr;
        const hasLogs = !!(attendance.loginTime || (attendance.sessions && attendance.sessions.length > 0));

        if (!hasLogs && (fhMatches || shMatches || attendance.status === leave.leaveType || attendance.status === 'Leave')) {
          await Attendance.deleteOne({ _id: attendance._id });
        } else {
          if (fhMatches) {
            attendance.firstHalf = { status: null, leaveId: null, leaveType: null };
          }
          if (shMatches) {
            attendance.secondHalf = { status: null, leaveId: null, leaveType: null };
          }
          await attendance.save({ bypassTenant: true } as any);
          await recalculateAttendanceForUserAndDate(leave.userId, startOfDay);
        }
      }
    }
  }

  /**
   * Single source of truth for handling leave status changes (e.g. approve, reject, pending).
   * Ensures idempotency and proper deduction / restoration of leave balances and attendance.
   */
  static async processLeaveStatusUpdate({
    leaveId,
    targetStatus,
    approverId
  }: {
    leaveId: string;
    targetStatus: 'approved' | 'rejected' | 'pending';
    approverId: string;
  }): Promise<{ leave: any; previousStatus: string; newStatus: string; modified: boolean }> {
    await dbConnect();
    const Leave = (await import('@/models/Leave')).default;
    const leave = await Leave.findById(leaveId, null, { bypassTenant: true });
    if (!leave) throw new Error('Leave request not found');

    const previousStatus = leave.status;
    if (previousStatus === targetStatus) {
      return { leave, previousStatus, newStatus: targetStatus, modified: false };
    }

    const userIdStr = leave.userId.toString();
    await this.syncLeaveBalance(userIdStr);
    const user = await User.findById(leave.userId, null, { bypassTenant: true });
    if (!user) throw new Error('User not found');

    const days = leave.numberOfDays || 1;

    // 1. Transitioning TO approved from non-approved:
    if (targetStatus === 'approved' && previousStatus !== 'approved') {
      await this.deductBalanceForLeave(user, leave, days);
      user.markModified('leaveBalance');
      await user.save({ bypassTenant: true } as any);

      leave.status = 'approved';
      leave.approvedBy = approverId as any;
      await leave.save({ bypassTenant: true } as any);

      const { syncLeaveToAttendance } = await import('@/lib/halfDayUtils');
      await syncLeaveToAttendance(leave, true);
    }
    // 2. Transitioning FROM approved to non-approved (reverting prior approval):
    else if (previousStatus === 'approved' && targetStatus !== 'approved') {
      await this.refundBalanceForLeave(user, leave, days);
      user.markModified('leaveBalance');
      await user.save({ bypassTenant: true } as any);

      leave.status = targetStatus;
      leave.approvedBy = approverId as any;
      await leave.save({ bypassTenant: true } as any);

      await this.removeLeaveFromAttendance(leave);
    }
    // 3. Transition between pending and rejected (neither was approved):
    else {
      leave.status = targetStatus;
      leave.approvedBy = approverId as any;
      await leave.save({ bypassTenant: true } as any);
    }

    return { leave, previousStatus, newStatus: targetStatus, modified: true };
  }
}

