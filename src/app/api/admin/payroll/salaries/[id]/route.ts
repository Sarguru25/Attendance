import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !['super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { monthlySalary, basicSalary, hra, da, bonus, effectiveFrom, bankName, accountNumber, ifscCode, salaryDeductions } = body;

    await dbConnect();
    const user = await User.findById(id);
    
    if (!user) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (user.role === 'admin' || user.role === 'super_admin') {
       return NextResponse.json({ error: 'Cannot modify salary for admins' }, { status: 400 });
    }

    if (bankName !== undefined) user.bankName = bankName;
    if (accountNumber !== undefined) user.accountNumber = accountNumber;
    if (ifscCode !== undefined) user.ifscCode = ifscCode;

    if (monthlySalary !== undefined) {
      const salaryNum = Number(monthlySalary);
      user.monthlySalary = salaryNum;

      // Sync with Current Salary Timeline
      const bsNum = basicSalary !== undefined && basicSalary !== null ? Number(basicSalary) : Math.round(salaryNum * 0.5);
      const hraNum = hra !== undefined && hra !== null ? Number(hra) : Math.round(salaryNum * 0.15);
      const daNum = da !== undefined && da !== null ? Number(da) : (salaryNum - bsNum - hraNum);
      const bonusNum = Number(bonus || 0);

      if (!user.salaryTimelines) user.salaryTimelines = [];

      const effDate = effectiveFrom ? new Date(`${effectiveFrom}T00:00:00`) : (user.joiningDate || new Date());

      if (user.salaryTimelines.length > 0) {
        // Find latest/active timeline to update
        const sortedTimelines = [...user.salaryTimelines].sort((a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime());
        const activeTL = sortedTimelines[sortedTimelines.length - 1];
        const targetIdx = user.salaryTimelines.findIndex(t => (t as any)._id?.toString() === (activeTL as any)._id?.toString() || t.effectiveFrom === activeTL.effectiveFrom);

        if (targetIdx !== -1) {
          user.salaryTimelines[targetIdx].monthlySalary = salaryNum;
          user.salaryTimelines[targetIdx].basicSalary = bsNum;
          user.salaryTimelines[targetIdx].hra = hraNum;
          user.salaryTimelines[targetIdx].da = daNum;
          user.salaryTimelines[targetIdx].bonus = bonusNum;
          if (effectiveFrom) user.salaryTimelines[targetIdx].effectiveFrom = effDate;
          user.salaryTimelines[targetIdx].updatedAt = new Date();
        }
      } else if (salaryNum > 0) {
        user.salaryTimelines.push({
          effectiveFrom: effDate,
          monthlySalary: salaryNum,
          basicSalary: bsNum,
          hra: hraNum,
          da: daNum,
          bonus: bonusNum,
          createdAt: new Date(),
          updatedAt: new Date()
        } as any);
      }

      user.salaryTimelines.sort((a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime());
      user.markModified('salaryTimelines');
    }

    if (salaryDeductions) {
      if (!user.salaryDeductions) {
        user.salaryDeductions = {
          esi: { enabled: false, amount: 0 },
          hra: { enabled: false, amount: 0 },
          loan: { enabled: false, principalAmount: 0, totalMonths: 0, remainingMonths: 0, monthlyDeduction: 0, totalPaid: 0, completed: false, startDate: null, endDate: null }
        };
      }
      if (!user.salaryDeductions.hra) user.salaryDeductions.hra = { enabled: false, amount: 0 };
      if (!user.salaryDeductions.loan) user.salaryDeductions.loan = { enabled: false, principalAmount: 0, totalMonths: 0, remainingMonths: 0, monthlyDeduction: 0, totalPaid: 0, completed: false, startDate: null, endDate: null };
      if (!user.salaryDeductions.esi) user.salaryDeductions.esi = { enabled: false, amount: 0 };

      if (salaryDeductions.hra) {
        user.salaryDeductions.hra.enabled = salaryDeductions.hra.enabled;
        user.salaryDeductions.hra.amount = salaryDeductions.hra.amount;
      }
      
      if (salaryDeductions.loan) {
        user.salaryDeductions.loan.enabled = salaryDeductions.loan.enabled;
        user.salaryDeductions.loan.principalAmount = salaryDeductions.loan.principalAmount;
        user.salaryDeductions.loan.totalMonths = salaryDeductions.loan.totalMonths;
        user.salaryDeductions.loan.startDate = salaryDeductions.loan.startDate;
        user.salaryDeductions.loan.endDate = salaryDeductions.loan.endDate;
        
        if (salaryDeductions.loan.enabled && salaryDeductions.loan.totalMonths > 0) {
          user.salaryDeductions.loan.monthlyDeduction = salaryDeductions.loan.principalAmount / salaryDeductions.loan.totalMonths;
          if (!user.salaryDeductions.loan.totalPaid) {
            user.salaryDeductions.loan.remainingMonths = salaryDeductions.loan.totalMonths;
            user.salaryDeductions.loan.totalPaid = 0;
            user.salaryDeductions.loan.completed = false;
          }
        } else {
          user.salaryDeductions.loan.monthlyDeduction = 0;
          user.salaryDeductions.loan.remainingMonths = 0;
          user.salaryDeductions.loan.totalPaid = 0;
          user.salaryDeductions.loan.completed = false;
        }
      }
      
      // ESI logic: strictly disabled for interns and salaries > 21000
      if (user.role === 'intern' || user.monthlySalary > 21000) {
        user.salaryDeductions.esi.enabled = false;
        user.salaryDeductions.esi.amount = 0;
      } else if (salaryDeductions.esi) {
        const esiEnabled = Boolean(salaryDeductions.esi.enabled);
        user.salaryDeductions.esi.enabled = esiEnabled;
        user.salaryDeductions.esi.amount = esiEnabled ? Math.round(user.monthlySalary * 0.0075) : 0;
      }
    }

    user.markModified('salaryDeductions');
    await user.save();

    return NextResponse.json({ message: 'Salary configuration saved successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
