import { getToken } from 'firebase/messaging';
import { getFirebaseMessaging } from './firebase';

export const requestWebPushPermission = async (): Promise<string | null> => {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    if (!('Notification' in window)) {
      console.log('This browser does not support desktop notification');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const msg = await getFirebaseMessaging();
      if (msg) {
        // Register the service worker manually
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        
        // Wait for the service worker to be ready
        await navigator.serviceWorker.ready;

        // NOTE: If you experience errors here, you may need a VAPID key.
        // Obtain one from Firebase Console -> Project Settings -> Cloud Messaging -> Web Configuration
        // And pass it via: vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
        const token = await getToken(msg, {
          serviceWorkerRegistration: registration,
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY // Optional if not strict, but strongly recommended
        });
        
        if (token) {
          console.log('WEB FCM TOKEN: ' + token);
          return token;
        } else {
          console.log('No registration token available. Request permission to generate one.');
          return null;
        }
      }
    } else {
      console.warn('Web push permission denied or dismissed.');
      return null;
    }
  } catch (error) {
    console.error('An error occurred while retrieving web push token. ', error);
    return null;
  }
  return null;
};
