import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Notification from '@/models/Notification';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Fetch notifications meant for this user OR meant for their role
    const notifications = await Notification.find({
      $or: [
        { recipientId: session.user.id },
        { targetRole: session.user.role }
      ]
    } as any, null, { bypassTenant: true })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({ notifications });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    await dbConnect();

    if (action === 'mark-all-read') {
      await Notification.updateMany(
        {
          $or: [
            { recipientId: session.user.id },
            { targetRole: session.user.role }
          ]
        } as any,
        { $set: { isRead: true } },
        { bypassTenant: true } as any
      );
      return NextResponse.json({ message: 'All notifications marked as read' });
    }

    const { id } = await req.json();
    if (id) {
      await Notification.findByIdAndUpdate(id, { $set: { isRead: true } }, { bypassTenant: true });
      return NextResponse.json({ message: 'Notification marked as read' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
