import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import PushToken from '@/models/PushToken';
import { auth } from '@/auth';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token, platform } = await req.json();

    if (!token || !platform) {
      return NextResponse.json({ error: 'Token and platform are required' }, { status: 400 });
    }

    if (!['web', 'android', 'ios'].includes(platform)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }

    await dbConnect();

    // Use findOneAndUpdate with upsert to prevent duplicate tokens gracefully
    // If the token exists, it updates the userId and platform (handling cases where a device is transferred)
    // If the token does not exist, it creates a new record.
    await PushToken.findOneAndUpdate(
      { token }, 
      { 
        userId: session.user.id,
        platform 
      }, 
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, message: 'Token registered successfully' }, { status: 200 });

  } catch (error: any) {
    console.error('Error registering push token:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
