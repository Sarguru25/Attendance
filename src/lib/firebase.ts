import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, isSupported, Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyCbTUYmWhYGU4sBp69L2KhC2h7nR8sF4Gw",
  authDomain: "attendance-app-b0bce.firebaseapp.com",
  projectId: "attendance-app-b0bce",
  storageBucket: "attendance-app-b0bce.firebasestorage.app",
  messagingSenderId: "172747987411",
  appId: "1:172747987411:web:77a1f73f4a9b7a6f89b726"
};

// Initialize Firebase only on the client-side to prevent SSR issues
export const app = typeof window !== 'undefined' && !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const getFirebaseMessaging = async (): Promise<Messaging | null> => {
  if (typeof window === 'undefined') return null;
  const supported = await isSupported();
  if (supported) {
    return getMessaging(app);
  }
  return null;
};
