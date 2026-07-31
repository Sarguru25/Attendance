import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Permission from '@/models/Permission';
import PermissionBalance from '@/models/PermissionBalance';
import Notification from '@/models/Notification';
import User from '@/models/User';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const permissions = await Permission.find({ userId: session.user.id })
      .sort({ date: -1, createdAt: -1 })
      .populate('currentApprover', 'name email')
      .populate('approvedBy', 'name email')
      .lean();

    return Response.json({ permissions }, { status: 200 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { date, fromTime, toTime, duration, reason } = body;

    if (!date || !fromTime || !toTime || !duration || !reason) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const permissionDate = new Date(date);
    const year = permissionDate.getFullYear();
    const month = permissionDate.getMonth() + 1;

    await dbConnect();

    // 1. Check if balance is available
    let balance = await PermissionBalance.findOne({ userId: session.user.id, year, month });
    if (!balance) {
      balance = await PermissionBalance.create({
        companyId: session.user.companyId,
        userId: session.user.id,
        year, month, allowedMinutes: 120, usedMinutes: 0, remainingMinutes: 120
      });
    }

    if (duration > balance.remainingMinutes) {
      return Response.json({ error: `Requested duration exceeds your remaining balance for this month (${balance.remainingMinutes} mins left).` }, { status: 400 });
    }

    // 2. Fetch user to get their manager/TL for approval routing
    const user = await User.findById(session.user.id).lean();
    let currentApprover = user?.reportsTo;
    if (!currentApprover) {
      // If no manager, find an admin
      const admin = await User.findOne({ role: 'admin', companyId: session.user.companyId });
      currentApprover = admin?._id;
    }

    // 3. Create permission request
    const permission = await Permission.create({
      companyId: session.user.companyId,
      userId: session.user.id,
      date: permissionDate,
      fromTime,
      toTime,
      duration,
      reason,
      status: 'Pending Approval',
      currentApprover,
      compensatedMinutes: 0,
      pendingMinutes: duration
    });

    // Notify Manager
    if (currentApprover) {
      await Notification.create({
        recipientId: currentApprover,
        type: 'PERMISSION_REQUEST',
        message: `${session.user.name} has requested a permission for ${duration} minutes on ${permissionDate.toLocaleDateString()}.`,
        link: '/employee/approvals',
        companyId: session.user.companyId
      });
    }

    return Response.json({ message: 'Permission requested successfully', permission }, { status: 201 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
