'use client';

import { useState, useEffect } from 'react';
import { requestWebPushPermission } from '@/lib/webPushNotifications';

export default function WebPushInitializer() {
  const [isSupported, setIsSupported] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [token, setToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTestNotification = async () => {
    setTestStatus('loading');
    setTestResult(null);
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST'
      });
      const data = await response.json();
      if (response.ok) {
        setTestStatus('success');
        setTestResult(`Test notification sent successfully. Sent to ${data.result?.sent} devices.`);
      } else {
        setTestStatus('error');
        setTestResult(data.error || 'Failed to send notification.');
      }
    } catch (err: any) {
      console.error(err);
      setTestStatus('error');
      setTestResult('Failed to send notification.');
    }
  };
  useEffect(() => {
    // Check if notifications are supported on mount
    if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator) {
      setIsSupported(true);
    }
  }, []);

  const handleEnableNotifications = async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const fcmToken = await requestWebPushPermission();
      if (fcmToken) {
        // Send the token to our Next.js backend
        const response = await fetch('/api/notifications/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: fcmToken, platform: 'web' }),
        });

        if (response.ok) {
          setToken(fcmToken);
          setStatus('success');
        } else {
          const errorData = await response.json();
          setStatus('error');
          setErrorMessage(errorData.error || 'Failed to register token with server.');
        }
      } else {
        setStatus('error');
        setErrorMessage('Permission denied, or token generation failed. Check console for details.');
      }
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'An unexpected error occurred.');
    }
  };

  if (!isSupported) {
    return null; // Don't render on environments that don't support it (e.g. Capacitor natively without browser APIs)
  }

  if (status === 'success') {
    return (
      <div className="p-4 bg-green-100 text-green-800 rounded-md my-4 shadow-sm border border-green-200">
        <p className="font-bold">Web Push Enabled!</p>
        <p className="text-xs mt-1 break-all bg-green-50 p-2 rounded">Token: {token}</p>

        <div className="mt-4 pt-4 border-t border-green-200">
          <button
            onClick={handleTestNotification}
            disabled={testStatus === 'loading'}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm font-medium"
          >
            {testStatus === 'loading' ? 'Sending...' : 'Send Test Notification'}
          </button>
          
          {testStatus === 'success' && <p className="mt-2 text-sm text-green-700 font-medium">{testResult}</p>}
          {testStatus === 'error' && <p className="mt-2 text-sm text-red-600 font-medium">{testResult}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md my-4 shadow-sm">
      <h3 className="text-lg font-semibold text-blue-900 mb-1">Browser Notifications Test</h3>
      <p className="text-sm text-blue-700 mb-4">
        Enable browser notifications to test Firebase Web Push.
      </p>
      <button
        onClick={handleEnableNotifications}
        disabled={status === 'loading'}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm font-medium"
      >
        {status === 'loading' ? 'Enabling...' : 'Enable Notifications'}
      </button>
      {status === 'error' && (
        <p className="mt-3 text-sm text-red-600 font-medium">{errorMessage}</p>
      )}
    </div>
  );
}
