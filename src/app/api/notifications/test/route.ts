import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sendWebPushNotification } from '@/lib/sendWebPushNotification';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await sendWebPushNotification(session.user.id, {
      title: 'TruFlow Attendance',
      body: 'This is a test push notification.'
    });

    if (result.found === 0) {
      return NextResponse.json({ success: false, error: 'No web push tokens found for this user.' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Test notification processed successfully.', 
      result 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error testing push notification:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
