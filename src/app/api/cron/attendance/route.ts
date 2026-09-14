import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import Notification from '@/models/Notification';

export async function GET(req: Request) {
  try {
    // Basic auth check for cron jobs if needed
    // const authHeader = req.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return new Response('Unauthorized', { status: 401 });
    // }

    await dbConnect();
    
    const now = new Date();
    const istDateString = now.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
    const [month, day, year] = istDateString.split('/');
    const today = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0));

    const activeEmployees = await User.find({ isActive: true, role: { $ne: 'admin' } });
    
    let notifiedCount = 0;

    for (const employee of activeEmployees) {
      // Check if attendance exists for today
      const attendance = await Attendance.findOne({
        userId: employee._id,
        date: { $gte: today }
      });

      if (!attendance) {
        // Check for approved permission today
        const Permission = (await import('@/models/Permission')).default;
        const todayEnd = new Date(today.getTime() + 23*3600*1000 + 59*60*1000);
        const approvedPermissions = await Permission.find({
          userId: employee._id,
          date: { $gte: today, $lte: todayEnd },
          status: { $in: ['Approved', 'Pending Compensation', 'Partially Compensated', 'Fully Compensated'] as any }
        }).lean();

        const { calculateEffectiveExpectedCheckIn, parseTimeToMinutes } = await import('@/lib/attendanceUtils');
        const userWithShift = await User.findById(employee._id).populate('shiftId').lean();
        const shiftStartStr = (userWithShift?.shiftId as any)?.startTime || '09:00';

        const { morningPermission, effectiveCheckInMinutes } = calculateEffectiveExpectedCheckIn({
          shiftStart: shiftStartStr,
          permissions: approvedPermissions
        });

        const currentIstTime = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
        const currentMins = parseTimeToMinutes(currentIstTime);

        // If employee has a morning permission and current time is still within permission window or grace, do not notify prematurely
        if (morningPermission && currentMins < effectiveCheckInMinutes) {
          continue;
        }

        const alertMessage = morningPermission 
          ? `Employee ${employee.name} had an approved permission (${morningPermission.fromTime} - ${morningPermission.toTime}) but has not checked in.`
          : `Employee ${employee.name} has not checked in today.`;

        // Send notification to Admin and Reporting Manager
        const admin = await User.findOne({ role: 'admin' });
        
        if (admin) {
          await Notification.create({
            recipientId: admin._id,
            type: 'ATTENDANCE_ALERT',
            message: alertMessage,
            link: '/admin/attendance',
          });
        }

        if (employee.reportsTo) {
          await Notification.create({
            recipientId: employee.reportsTo,
            type: 'ATTENDANCE_ALERT',
            message: alertMessage.replace(`Employee ${employee.name}`, `Team member ${employee.name}`),
            link: '/admin/attendance',
          });
        }
        
        notifiedCount++;
      }
    }

    return NextResponse.json({ success: true, message: `Processed ${notifiedCount} absent employees.` }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
