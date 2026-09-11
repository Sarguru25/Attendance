import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Payroll from '@/models/Payroll';

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { month, year, isLocked } = await req.json();

    if (!month || !year || isLocked === undefined) {
      return NextResponse.json({ error: 'Month, year, and lock status are required' }, { status: 400 });
    }

    await dbConnect();
    const result = await Payroll.updateMany(
      { month, year },
      { $set: { isLocked: Boolean(isLocked) } }
    );

    return NextResponse.json({
      message: isLocked ? 'Payroll locked successfully' : 'Payroll unlocked successfully',
      isLocked: Boolean(isLocked),
      updatedCount: result.modifiedCount
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
