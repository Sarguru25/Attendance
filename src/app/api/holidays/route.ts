import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Holiday from '@/models/Holiday';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year');
    const type = searchParams.get('type');

    await dbConnect();

    const user = await User.findById(session.user.id, null, { bypassTenant: true });

    let query: any = {};
    if (user?.companyId) {
      query.$or = [
        { companyId: user.companyId },
        { companyId: { $exists: false } },
        { companyId: null }
      ];
    }

    if (year) {
      const start = new Date(`${year}-01-01`);
      const end = new Date(`${year}-12-31`);
      query.date = { $gte: start, $lte: end };
    } else if (type === 'restricted') {
      const currentYear = new Date().getFullYear();
      const start = new Date(`${currentYear}-01-01`);
      query.date = { $gte: start };
    } else {
      // If no year, get upcoming holidays
      const now = new Date();
      const istDateString = now.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
      const [monthStr, dayStr, currentYearStr] = istDateString.split('/');
      const today = new Date(Date.UTC(parseInt(currentYearStr), parseInt(monthStr) - 1, parseInt(dayStr), 0, 0, 0, 0));
      query.date = { $gte: today };
    }

    if (type) {
      query.holidayType = type;
    }

    const holidays = await Holiday.find(query, null, { bypassTenant: true }).sort({ date: 1 });
    return NextResponse.json({ holidays });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
