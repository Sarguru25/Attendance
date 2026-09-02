import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const users = await User.find({ role: { $ne: 'admin' }, isActive: true })
      .select('name employeeId role department designation monthlySalary bankName accountNumber ifscCode salaryDeductions salaryTimelines joiningDate')
      .lean();

    return NextResponse.json({ users }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
