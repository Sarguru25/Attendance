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

    const { syncPermissionBalance } = await import('@/lib/attendanceUtils');
    const balance = await syncPermissionBalance(permission.userId, year, month, permission.companyId);

    if (status === 'Approved') {
      if (permission.duration > balance.remainingMinutes) {
        return Response.json({ error: 'Insufficient balance to approve this permission' }, { status: 400 });
      }
      
      permission.status = 'Pending Compensation';
      permission.pendingMinutes = permission.duration;
      permission.approvedBy = session.user.id as any;
      await permission.save();

      await syncPermissionBalance(permission.userId, year, month, permission.companyId);
    } else {
      permission.status = 'Rejected';
      permission.approvedBy = session.user.id as any;
      await permission.save();

      await syncPermissionBalance(permission.userId, year, month, permission.companyId);
    }

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
