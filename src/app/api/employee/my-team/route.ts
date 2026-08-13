import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import Leave from '@/models/Leave';
import '@/models/Shift';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // The logged-in user
    const currentUserId = session.user.id;

    // Fetch employees reporting to this user
    const teamMembers = await User.find({ reportsTo: currentUserId, isActive: true }, null, { bypassTenant: true })
      .select('employeeId name email phoneNumber department designation profileImage shiftId joiningDate role companyId')
      .populate('shiftId')
      .populate('companyId', 'name')
      .lean();

    if (!teamMembers || teamMembers.length === 0) {
      return NextResponse.json({ team: [], summary: { total: 0, present: 0, onLeave: 0, absent: 0, late: 0 } });
    }

    // Get today's attendance for the team
    const now = new Date();
    const istDateString = now.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
    const [month, day, year] = istDateString.split('/');
    const today = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0));

    const teamMemberIds = teamMembers.map(m => m._id);

    const attendances = await Attendance.find({
      userId: { $in: teamMemberIds },
      date: today
    }).lean();

    const todayAttendancesMap = new Map();
    attendances.forEach(a => todayAttendancesMap.set(a.userId.toString(), a));

    let present = 0;
    let onLeave = 0;
    let absent = 0;
    let late = 0;

    const team = teamMembers.map(member => {
      const attendance = todayAttendancesMap.get(member._id.toString());
      let status = 'absent';
      if (attendance) {
        status = attendance.status;
        if (status === 'present') present++;
        if (status === 'late') {
          present++; // Late is usually also counted as present today, or we can just count late
          late++;
        }
        if (status === 'absent') absent++;
        if (status === 'Leave' || status === 'half-day') onLeave++;
      } else {
        absent++;
      }

      return {
        _id: member._id,
        employeeId: member.employeeId,
        name: member.name,
        email: member.email,
        department: member.department,
        designation: member.designation,
        profileImage: member.profileImage,
        shift: member.shiftId,
        company: member.companyId,
        status: status,
        todayAttendance: attendance || null
      };
    });

    return NextResponse.json({
      team,
      summary: {
        total: team.length,
        present,
        onLeave,
        absent,
        late
      }
    });

  } catch (error) {
    console.error('Error fetching My Team:', error);
    return NextResponse.json({ error: 'Failed to fetch team data' }, { status: 500 });
  }
}
