'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function DashboardActions() {
  const router = useRouter();
  const [loadingType, setLoadingType] = useState<string | null>(null);

  const handleReminder = async (type: 'check-in' | 'check-out') => {
    setLoadingType(type);
    try {
      const res = await fetch('/api/attendance/reminder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Success! Emails sent: ${data.sentTo?.length || 0}`);
      } else {
        toast.error(data.error || 'Failed to send reminder');
      }
    } catch (error) {
      toast.error('An error occurred');
      console.error(error);
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3">
      <button 
        onClick={() => handleReminder('check-in')}
        disabled={loadingType === 'check-in'}
        className="w-full sm:w-auto px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors shadow-sm font-medium disabled:opacity-50"
      >
        {loadingType === 'check-in' ? 'Sending...' : 'Check In Reminder'}
      </button>
      
      <button 
        onClick={() => handleReminder('check-out')}
        disabled={loadingType === 'check-out'}
        className="w-full sm:w-auto px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors shadow-sm font-medium disabled:opacity-50"
      >
        {loadingType === 'check-out' ? 'Sending...' : 'Check Out Reminder'}
      </button>

      <button 
        onClick={() => router.push('/admin/payroll')}
        className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm font-medium"
      >
        Generate Payroll
      </button>
    </div>
  );
}
