import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import AttendanceCorrection from '@/models/AttendanceCorrection';
import MissPunch from '@/models/MissPunch';
import User from '@/models/User';
import Shift from '@/models/Shift';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    await dbConnect();

    let query: any = { userId: session.user.id };

    let requestQuery: any = { employeeId: session.user.id };
    
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      query.date = { $gte: startDate, $lte: endDate };
      requestQuery.date = { $gte: startDate, $lte: endDate };
    }

    const attendances = await Attendance.find(query).sort({ date: -1 }).lean();

    const corrections = await AttendanceCorrection.find(requestQuery).sort({ createdAt: -1 }).lean();
    const missPunches = await MissPunch.find(requestQuery).sort({ createdAt: -1 }).lean();

    const attendancesWithStatus = attendances.map((att: any) => {
      const correction = corrections.find((c: any) => c.attendanceId?.toString() === att._id.toString());
      const missPunch = missPunches.find((m: any) => {
        if (!m.date || !att.date) return false;
        return new Date(m.date).toISOString().split('T')[0] === new Date(att.date).toISOString().split('T')[0];
      });

      const request = correction || missPunch;

      return {
        ...att,
        correctionStatus: request ? request.status : null,
        correctionType: request ? (correction ? 'Attendance Correction' : 'Miss Punch') : null
      };
    });

    missPunches.forEach((m: any) => {
      if (!m.date) return;
      const mDateStr = new Date(m.date).toISOString().split('T')[0];
      const match = attendances.find((att: any) => att.date && new Date(att.date).toISOString().split('T')[0] === mDateStr);
      if (!match) {
        attendancesWithStatus.push({
          _id: m._id,
          date: m.date,
          status: 'absent',
          loginTime: m.requestedCheckIn || null,
          logoutTime: m.requestedCheckOut || null,
          totalHours: null,
          correctionStatus: m.status,
          correctionType: 'Miss Punch'
        });
      }
    });

    attendancesWithStatus.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const user = await User.findById(session.user.id).populate('shiftId').lean();

    return NextResponse.json({ attendances: attendancesWithStatus, user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
