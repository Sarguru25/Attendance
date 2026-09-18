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

    // Sync gender-based leaves in case gender was updated
    if (user.gender === 'male' && user.leaveBalance.paternityLeave.total === 0) {
      user.leaveBalance.paternityLeave.total = 2;
      user.leaveBalance.paternityLeave.available = 2 - user.leaveBalance.paternityLeave.taken;
      needsUpdate = true;
    }
    if (user.gender === 'female' && user.leaveBalance.maternityLeave.total === 0) {
      user.leaveBalance.maternityLeave.total = 60;
      user.leaveBalance.maternityLeave.available = 60 - user.leaveBalance.maternityLeave.taken;
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
            user.leaveBalance.casualLeave.available += 10;
          } else {
            user.leaveBalance.casualLeave.available += increment;
          }
          needsUpdate = true;
        }
      }
    }

    // Recalculate CompOff available from CompOffCredit model
    if (!user.leaveBalance.compensatoryOff) {
      user.leaveBalance.compensatoryOff = { total: 0, available: 0, taken: 0, earned: 0 };
      needsUpdate = true;
    }

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

    const earned = compOffs.length;
    const currentAvailable = user.leaveBalance.compensatoryOff.available || 0;

    if (earned > currentAvailable) {
      // New credits were earned from attendance/approved requests
      user.leaveBalance.compensatoryOff.available = earned;
      user.leaveBalance.compensatoryOff.total = earned + (user.leaveBalance.compensatoryOff.taken || 0);
      user.leaveBalance.compensatoryOff.earned = user.leaveBalance.compensatoryOff.total;
      needsUpdate = true;
    } else if (currentAvailable > earned) {
      // User has manual available balance that wasn't backed by CompOffCredit records.
      // Backfill missing CompOffCredit records so balance is not lost upon sync/refresh.
      const diff = currentAvailable - earned;
      const now = new Date();
      const backfill = [];
      for (let i = 0; i < diff; i++) {
        backfill.push({
          employeeId: employeeObjId,
          companyId: user.companyId || (user.companyIds && user.companyIds[0]) || undefined,
          attendanceDate: now,
          earnedDate: now,
          availableFromDate: now,
          isUsed: false,
        });
      }
      await CompOffCredit.insertMany(backfill);
      user.leaveBalance.compensatoryOff.total = currentAvailable + (user.leaveBalance.compensatoryOff.taken || 0);
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

  static async checkEligibility(employeeId: string, leaveType: string, numberOfDays: number): Promise<{ eligible: boolean, reason?: string, requiresDocument?: boolean }> {
    const balance = await this.syncLeaveBalance(employeeId);

    if (leaveType === 'Casual Leave') {
      if (balance.casualLeave.total === 0) {
        return { eligible: false, reason: 'You must complete 6 months of service to be eligible for Casual Leave.' };
      }
      if (balance.casualLeave.available < numberOfDays) {
        return { eligible: false, reason: `Insufficient Casual Leave balance. You have ${balance.casualLeave.available} days left.` };
      }
      return { eligible: true };
    }

    if (leaveType === 'Sick Leave') {
      if (balance.sickLeave.available < numberOfDays) {
         return { eligible: false, reason: `Insufficient Sick Leave balance. You have ${balance.sickLeave.available} days left.` };
      }
      
      // Check document requirement
      // Rule: first 4 days without cert.
      const wouldBeUsedWithoutCert = balance.sickLeave.withoutCertificate.used + numberOfDays;
      if (wouldBeUsedWithoutCert > 4) {
        return { eligible: true, requiresDocument: true };
      }
      return { eligible: true };
    }

    if (leaveType === 'Restricted Holiday') {
      if (balance.restrictedLeave.available < numberOfDays) {
        return { eligible: false, reason: 'Restricted Holiday quota exceeded. Maximum 2 allowed per year.' };
      }
      return { eligible: true };
    }

    if (leaveType === 'Compensatory Off') {
      if (balance.compensatoryOff.available < numberOfDays) {
         return { eligible: false, reason: `Insufficient Comp-Off balance. You have ${balance.compensatoryOff.available} days available.` };
      }
      return { eligible: true };
    }

    if (leaveType === 'Maternity Leave') {
      if (balance.maternityLeave.total === 0) {
        return { eligible: false, reason: 'Maternity leave is only applicable for female employees.' };
      }
      if (balance.maternityLeave.available < numberOfDays) {
        return { eligible: false, reason: `Insufficient Maternity Leave balance. You have ${balance.maternityLeave.available} days left.` };
      }
      return { eligible: true }; 
    }

    if (leaveType === 'Paternity Leave') {
      if (balance.paternityLeave.total === 0) {
        return { eligible: false, reason: 'Paternity leave is only applicable for male employees.' };
      }
      if (balance.paternityLeave.available < numberOfDays) {
        return { eligible: false, reason: `Insufficient Paternity Leave balance. You have ${balance.paternityLeave.available} days left.` };
      }
      return { eligible: true }; 
    }

    if (leaveType === 'Leave Without Pay') {
      return { eligible: true };
    }

    return { eligible: false, reason: 'Invalid leave type.' };
  }
}
