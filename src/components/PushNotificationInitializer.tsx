'use client';

import { useEffect } from 'react';

export default function PushNotificationInitializer() {
  useEffect(() => {
    const init = async () => {
      try {
        // Dynamically import the push notification logic
        // This ensures Capacitor and its plugins are only imported on the client side
        const { initializePushNotifications } = await import('@/lib/pushNotifications');
        await initializePushNotifications();
      } catch (error) {
        console.error('Failed to initialize push notifications', error);
      }
    };

    init();
  }, []);

  return null; // This component doesn't render anything
}
