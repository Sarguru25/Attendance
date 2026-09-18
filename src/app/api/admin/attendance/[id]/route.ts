import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Attendance from '@/models/Attendance';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const data = await req.json();
    const { loginTime, logoutTime, status } = data; // Expected "HH:mm" or empty string

    await dbConnect();

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
    }

    if (status === 'none' || status === 'clear') {
      const attendanceDate = attendance.date;
      const userId = attendance.userId;

      await Attendance.findByIdAndDelete(id);

      const CompOffCredit = (await import('@/models/CompOffCredit')).default;
      await CompOffCredit.findOneAndDelete({ employeeId: userId, attendanceDate });

      return NextResponse.json({ message: 'Attendance record deleted successfully' });
    }

    // Parse time and apply to the existing date
    if (loginTime) {
      const [hours, minutes] = loginTime.split(':');
      const dateStr = new Date(attendance.date).toISOString().split('T')[0];
      attendance.loginTime = new Date(`${dateStr}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00+05:30`);
    } else {
      attendance.loginTime = undefined;
    }

    if (logoutTime) {
      const [hours, minutes] = logoutTime.split(':');
      const dateStr = new Date(attendance.date).toISOString().split('T')[0];
      attendance.logoutTime = new Date(`${dateStr}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00+05:30`);
    } else {
      attendance.logoutTime = undefined;
    }

    if (attendance.loginTime && attendance.logoutTime) {
      const diffMs = attendance.logoutTime.getTime() - attendance.loginTime.getTime();
      attendance.totalHours = diffMs / (1000 * 60 * 60);
    } else {
      attendance.totalHours = undefined;
    }

    attendance.status = status;
    await attendance.save();

    return NextResponse.json({ message: 'Attendance updated successfully', attendance });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
