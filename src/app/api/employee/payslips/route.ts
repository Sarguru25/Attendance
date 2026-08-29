import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Payroll from '@/models/Payroll';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const rawPayrolls = await Payroll.find({ userId: session.user.id })
      .sort({ year: -1, month: -1, generatedAt: -1, _id: -1 })
      .populate('userId', 'name employeeId department designation bankName accountNumber ifscCode joiningDate address location leaveBalance salaryDeductions')
      .lean();

    // Deduplicate: if there are multiple payrolls for the same month & year, keep the latest one and delete older ones from DB
    const payrolls: any[] = [];
    const seenMonthYear = new Set<string>();
    const idsToDelete: string[] = [];

    for (const p of rawPayrolls) {
      const key = `${p.year}-${p.month}`;
      if (seenMonthYear.has(key)) {
        idsToDelete.push((p as any)._id);
      } else {
        seenMonthYear.add(key);
        payrolls.push(p);
      }
    }

    if (idsToDelete.length > 0) {
      await Payroll.deleteMany({ _id: { $in: idsToDelete } });
    }

    return NextResponse.json({ payrolls });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

