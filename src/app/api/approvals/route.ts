import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Leave from '@/models/Leave';
import MissPunch from '@/models/MissPunch';
import AttendanceCorrection from '@/models/AttendanceCorrection';
import OvertimeRequest from '@/models/OvertimeRequest';
import WFHRequest from '@/models/WFHRequest';
import Permission from '@/models/Permission';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const userId = session.user.id;

    // Fetch all pending requests where approverId is current user or currentApprover for leaves
    const [
      leaves,
      missPunches,
      attendanceCorrections,
      overtimes,
      wfhs,
      permissions
    ] = await Promise.all([
      Leave.find({ currentApprover: userId, status: 'pending' }).populate('userId', 'name employeeId').lean(),
      MissPunch.find({ approverId: userId, status: 'pending' }).populate('employeeId', 'name employeeId').lean(),
      AttendanceCorrection.find({ approverId: userId, status: 'pending' }).populate('employeeId', 'name employeeId').lean(),
      OvertimeRequest.find({ approverId: userId, status: 'pending' }).populate('employeeId', 'name employeeId').lean(),
      WFHRequest.find({ approverId: userId, status: 'pending' }).populate('employeeId', 'name employeeId').lean(),
      Permission.find({ currentApprover: userId, status: 'Pending Approval' }).populate('userId', 'name employeeId').lean(),
    ]);

    // Normalize data structure for UI
    const approvals = [
      ...leaves.map(l => ({ ...l, _id: l._id?.toString(), requestType: 'LEAVE', employee: l.userId })),
      ...missPunches.map(m => ({ ...m, _id: m._id?.toString(), requestType: 'MISS_PUNCH', subType: m.requestType, employee: m.employeeId })),
      ...attendanceCorrections.map(a => ({ ...a, _id: a._id?.toString(), requestType: 'ATTENDANCE_CORRECTION', employee: a.employeeId })),
      ...overtimes.map(o => ({ ...o, _id: o._id?.toString(), requestType: 'OVERTIME', employee: o.employeeId })),
      ...wfhs.map(w => ({ ...w, _id: w._id?.toString(), requestType: 'WFH', employee: w.employeeId })),
      ...permissions.map(p => ({ ...p, _id: p._id?.toString(), requestType: 'PERMISSION', employee: p.userId })),
    ];

    return NextResponse.json({ approvals });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
