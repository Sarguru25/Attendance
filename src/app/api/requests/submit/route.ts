import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import MissPunch from '@/models/MissPunch';
import AttendanceCorrection from '@/models/AttendanceCorrection';
import OvertimeRequest from '@/models/OvertimeRequest';
import WFHRequest from '@/models/WFHRequest';
import User from '@/models/User';
import Notification from '@/models/Notification';
import Attendance from '@/models/Attendance';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestType, ...data } = await req.json();

    await dbConnect();
    const user = await User.findById(session.user.id, null, { bypassTenant: true });
    let approverId = user?.reportsTo;

    if (!approverId) {
      const admin = await User.findOne({ role: 'admin' }, null, { bypassTenant: true });
      if (admin) approverId = admin._id;
    }

    if (!approverId) {
      return NextResponse.json({ error: 'No approver found' }, { status: 400 });
    }

    let request;
    let notificationMsg = '';

    switch (requestType) {
      case 'MISS_PUNCH':
        request = await MissPunch.create({ ...data, requestType: data.requestTypeSubType, employeeId: session.user.id, approverId, status: 'pending' });
        notificationMsg = `${user?.name} has submitted a Miss Punch request.`;
        break;
      case 'ATTENDANCE_CORRECTION': {
        let finalAttendanceId = data.attendanceId;
        
        if (!finalAttendanceId) {
          // Find the attendance record for this user on the selected date
          // The data.date might be '2026-07-01' so we can match it
          // Parse base date as UTC to prevent server timezone shifting
          const [year, month, day] = data.date.split('-');
          const startOfDay = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0));
          const endOfDay = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59, 999));
          
          const attendance = await Attendance.findOne({
            userId: session.user.id,
            date: { $gte: startOfDay, $lte: endOfDay }
          });
          
          if (!attendance) {
            return NextResponse.json({ error: 'No attendance record found for this date. Please submit a Miss Punch request instead.' }, { status: 400 });
          }
          finalAttendanceId = attendance._id;
        }

        request = await AttendanceCorrection.create({ ...data, attendanceId: finalAttendanceId, employeeId: session.user.id, approverId, status: 'pending' });
        notificationMsg = `${user?.name} has submitted an Attendance Correction request.`;
        break;
      }
      case 'OVERTIME':
        request = await OvertimeRequest.create({ ...data, employeeId: session.user.id, approverId, status: 'pending' });
        notificationMsg = `${user?.name} has submitted an Overtime request.`;
        break;
      case 'WFH':
        request = await WFHRequest.create({ ...data, employeeId: session.user.id, approverId, status: 'pending' });
        notificationMsg = `${user?.name} has submitted a WFH request.`;
        break;
      default:
        return NextResponse.json({ error: 'Invalid requestType' }, { status: 400 });
    }

    if (approverId) {
      await Notification.create({
        recipientId: approverId,
        type: `${requestType}_REQUEST`,
        message: notificationMsg,
        link: '/employee/approvals',
      });
    }

    return NextResponse.json({ message: 'Request submitted successfully', request }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}