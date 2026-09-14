import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Permission from '@/models/Permission';
import PermissionBalance from '@/models/PermissionBalance';
import Notification from '@/models/Notification';

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { status } = await req.json(); // 'Approved' | 'Rejected'
    if (!['Approved', 'Rejected'].includes(status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400 });
    }

    await dbConnect();
    const { id } = await props.params;
    const permission = await Permission.findById(id);
    if (!permission) return Response.json({ error: 'Permission not found' }, { status: 404 });

    if (permission.status !== 'Pending Approval') {
      return Response.json({ error: 'Permission is already ' + permission.status }, { status: 400 });
    }

    const permissionDate = new Date(permission.date);
    const year = permissionDate.getFullYear();
    const month = permissionDate.getMonth() + 1;

    let balance = await PermissionBalance.findOne({ userId: permission.userId, year, month });
    if (!balance) {
      return Response.json({ error: 'Permission balance not found' }, { status: 400 });
    }

    if (status === 'Approved') {
      if (permission.duration > balance.remainingMinutes) {
        return Response.json({ error: 'Insufficient balance to approve this permission' }, { status: 400 });
      }
      
      permission.status = 'Pending Compensation';
      permission.approvedBy = session.user.id as any;
      
      balance.usedMinutes += permission.duration;
      balance.remainingMinutes -= permission.duration;
      await balance.save();
    } else {
      permission.status = 'Rejected';
      permission.approvedBy = session.user.id as any;
    }

    await permission.save();

    const { recalculateAttendanceForUserAndDate } = await import('@/lib/attendanceUtils');
    await recalculateAttendanceForUserAndDate(permission.userId, permission.date);

    // Notify employee
    await Notification.create({
      recipientId: permission.userId,
      type: status === 'Approved' ? 'PERMISSION_APPROVED' : 'PERMISSION_REJECTED',
      message: `Your permission request for ${permission.duration} minutes on ${permissionDate.toLocaleDateString()} has been ${status.toLowerCase()}.`,
      link: '/employee/permissions',
      companyId: permission.companyId
    });

    return Response.json({ message: `Permission ${status.toLowerCase()} successfully`, permission }, { status: 200 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
