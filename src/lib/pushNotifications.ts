import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';

export const initializePushNotifications = async () => {
  // Only initialize on native platforms (Android/iOS)
  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications are only available on native platforms.');
    return;
  }

  try {
    // Check current permission status
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      // Request permission if not already granted
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('User denied push notification permission!');
      return;
    }

    // Register with Firebase Cloud Messaging (FCM)
    await PushNotifications.register();

    // Listeners for registration success and error
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('FCM TOKEN: ' + token.value);
      try {
        const response = await fetch('/api/notifications/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android' }),
        });
        if (!response.ok) {
          console.error('Failed to register Capacitor token to backend');
        } else {
          console.log('Capacitor token registered to backend successfully');
        }
      } catch (e) {
        console.error('Error sending Capacitor token to backend:', e);
      }
    });

    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Error on registration: ' + JSON.stringify(error));
    });

    // Listeners for receiving notifications and actions
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push notification received: ', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('Push notification action performed: ', action);
    });

  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
};