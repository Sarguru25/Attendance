import { initFirebaseAdmin } from './firebaseAdmin';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import dbConnect from './mongodb';
import PushToken from '@/models/PushToken';

export const sendWebPushNotification = async (
  userId: string,
  notification: { title: string; body: string; data?: { [key: string]: string } }
) => {
  const app = initFirebaseAdmin();
  const messaging = getMessaging(app);

  await dbConnect();

  // 1. Find all PushToken records for the given user (web, android, ios)
  const tokens = await PushToken.find({ userId }).lean();

  if (!tokens || tokens.length === 0) {
    return { found: 0, sent: 0, failed: 0 };
  }

  const tokenStrings = tokens.map((t) => t.token);

  // 2. Send the notification using Firebase Admin Messaging multicast
  const message: MulticastMessage = {
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: notification.data,
    tokens: tokenStrings,
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    
    // 3. Handle individual token failures
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            failedTokens.push(tokenStrings[idx]);
          }
        }
      });

      // 4. Remove stale tokens automatically from DB
      if (failedTokens.length > 0) {
        await PushToken.deleteMany({ token: { $in: failedTokens } });
      }
    }

    return {
      found: tokenStrings.length,
      sent: response.successCount,
      failed: response.failureCount,
    };
  } catch (error) {
    console.error('Error sending multicast message:', error);
    throw error;
  }
};
