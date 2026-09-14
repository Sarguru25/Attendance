import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import Shift from '@/models/Shift';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    const url = new URL(req.url);
    const monthParam = url.searchParams.get('month');
    const yearParam = url.searchParams.get('year');
    
    const now = new Date();
    const targetMonth = monthParam ? parseInt(monthParam) : now.getMonth() + 1;
    const targetYear = yearParam ? parseInt(yearParam) : now.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    const daysInMonth = endDate.getDate();

    const employees = await User.find({ role: { $nin: ['admin', 'super_admin'] }, isActive: true })
      .populate('shiftId')
      .lean();

    const userIds = employees.map(e => e._id);

    const attendances = await Attendance.find({
      userId: { $in: userIds },
      date: { $gte: startDate, $lte: endDate }
    }).populate('shiftId').lean();

    // 1. Late Coming Log (List of specific late instances)
    const lateLog = attendances
      .filter((a: any) => a.status === 'late' || (a.lateMinutes && a.lateMinutes > 0))
      .map((a: any) => {
        const user = employees.find(e => e._id.toString() === a.userId.toString());
        const shift = a.shiftId || user?.shiftId;
        return {
          employeeName: user?.name || 'Unknown',
          department: user?.department || 'Unknown',
          date: a.date,
          shiftStart: shift ? shift.startTime : '-',
          effectiveCheckInStart: a.effectiveCheckInStart || (shift ? shift.startTime : '-'),
          permissionMinutes: a.permissionMinutes || 0,
          actualCheckIn: a.loginTime || '-',
          lateBy: a.lateMinutes || 0
        };
      })
      .sort((a, b) => b.lateBy - a.lateBy); // Sort by highest late arrivals

    // 2. Monthly Matrix & Summary
    const monthlyData = employees.map((emp: any) => {
      const empAttendances = attendances.filter((a: any) => a.userId.toString() === emp._id.toString());
      
      const matrix: Record<number, string> = {};
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let halfDayCount = 0;
      let leaveCount = 0;
      let otCount = 0; // Placeholder for OT

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = new Date(targetYear, targetMonth - 1, day).toISOString().split('T')[0];
        const record = empAttendances.find((a: any) => new Date(a.date).toISOString().split('T')[0] === dateStr);
        
        if (record) {
          matrix[day] = record.status;
          switch (record.status) {
            case 'present': presentCount++; break;
            case 'late': lateCount++; break;
            case 'absent': absentCount++; break;
            case 'half-day': halfDayCount++; break;
            case 'Leave': leaveCount++; break;
            // Add other statuses if needed
          }
        } else {
          // If past date, mark as absent if no record, else '-'
          const checkDate = new Date(targetYear, targetMonth - 1, day);
          if (checkDate <= now && checkDate.getDay() !== 0) {
            // matrix[day] = 'absent';
            // absentCount++;
            matrix[day] = '-';
          } else {
            matrix[day] = '-';
          }
        }
      }

      return {
        employeeName: emp.name,
        department: emp.department,
        matrix,
        summary: {
          present: presentCount,
          late: lateCount,
          absent: absentCount,
          halfDay: halfDayCount,
          leave: leaveCount,
          ot: otCount
        }
      };
    });

    return NextResponse.json({
      month: targetMonth,
      year: targetYear,
      daysInMonth,
      lateLog,
      monthlyData
    });

  } catch (error: any) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
