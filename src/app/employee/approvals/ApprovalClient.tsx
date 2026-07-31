'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ApprovalClient() {
  const { data, error, isLoading, mutate } = useSWR('/api/approvals', fetcher);
  const [acting, setActing] = useState<string | null>(null);
  const [editedTimes, setEditedTimes] = useState<Record<string, { checkIn?: string, checkOut?: string }>>({});

  if (error) return <div className="text-destructive">Failed to load approvals.</div>;

  const handleTimeChange = (id: string, field: 'checkIn' | 'checkOut', value: string) => {
    setEditedTimes(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleAction = async (id: string, requestType: string, status: 'approved' | 'rejected', dateStr?: string) => {
    setActing(id);
    try {
      const payload: any = { id, requestType, status };
      
      if (status === 'approved' && (requestType === 'MISS_PUNCH' || requestType === 'ATTENDANCE_CORRECTION')) {
        const customCheckIn = editedTimes[id]?.checkIn;
        const customCheckOut = editedTimes[id]?.checkOut;
        
        if (customCheckIn && dateStr) {
          payload.finalCheckIn = new Date(`${format(new Date(dateStr), 'yyyy-MM-dd')}T${customCheckIn}:00`);
        }
        if (customCheckOut && dateStr) {
          payload.finalCheckOut = new Date(`${format(new Date(dateStr), 'yyyy-MM-dd')}T${customCheckOut}:00`);
        }
      }

      const res = await api('/api/approvals/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to process request');
      toast.success(json.message);
      mutate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActing(null);
    }
  };

  const renderDetails = (req: any) => {
    switch (req.requestType) {
      case 'LEAVE':
        return (
          <>
            <p className="text-sm text-card-foreground">Type: {req.leaveType}</p>
            <p className="text-sm text-muted-foreground">Date: {format(new Date(req.fromDate), 'MMM dd')} - {format(new Date(req.toDate), 'MMM dd, yyyy')}</p>
            {req.attachments && req.attachments.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">Supporting Documents:</p>
                <div className="flex flex-wrap gap-2">
                  {req.attachments.map((file: string, index: number) => (
                    <a
                      key={index}
                      href={file}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-primary hover:text-primary/80 hover:underline bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      View Document {index + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      case 'MISS_PUNCH':
      case 'ATTENDANCE_CORRECTION':
        const isMissPunch = req.requestType === 'MISS_PUNCH';
        const initialCheckIn = req.requestedCheckIn ? format(new Date(req.requestedCheckIn), 'HH:mm') : '';
        const initialCheckOut = req.requestedCheckOut ? format(new Date(req.requestedCheckOut), 'HH:mm') : '';
        const currentCheckIn = editedTimes[req._id]?.checkIn !== undefined ? editedTimes[req._id].checkIn : initialCheckIn;
        const currentCheckOut = editedTimes[req._id]?.checkOut !== undefined ? editedTimes[req._id].checkOut : initialCheckOut;

        return (
          <>
            <p className="text-sm text-card-foreground">{isMissPunch ? `Type: ${req.subType}` : 'Requested Correction'}</p>
            <p className="text-sm text-muted-foreground mb-2">Date: {format(new Date(req.date || req.currentCheckIn || new Date()), 'MMM dd, yyyy')}</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-2 bg-muted p-4 rounded-xl border border-border w-full sm:w-fit">
              <div className="flex-1">
                <label className="block text-xs font-bold text-muted-foreground mb-1">Check In</label>
                <input 
                  type="time" 
                  className="w-full bg-background border border-border text-foreground text-sm rounded-lg px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors" 
                  value={currentCheckIn}
                  onChange={(e) => handleTimeChange(req._id, 'checkIn', e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-muted-foreground mb-1">Check Out</label>
                <input 
                  type="time" 
                  className="w-full bg-background border border-border text-foreground text-sm rounded-lg px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors" 
                  value={currentCheckOut}
                  onChange={(e) => handleTimeChange(req._id, 'checkOut', e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">* You can modify these times before approving.</p>
          </>
        );
      case 'OVERTIME':
        return (
          <>
            <p className="text-sm text-card-foreground">Hours: {req.hours}</p>
            <p className="text-sm text-muted-foreground">Date: {format(new Date(req.date), 'MMM dd, yyyy')}</p>
          </>
        );
      case 'WFH':
        return (
          <>
            <p className="text-sm text-card-foreground">Work From Home</p>
            <p className="text-sm text-muted-foreground">Date: {format(new Date(req.fromDate), 'MMM dd')} - {format(new Date(req.toDate), 'MMM dd, yyyy')}</p>
          </>
        );
      case 'PERMISSION':
        return (
          <>
            <p className="text-sm text-card-foreground">Permission ({req.duration} mins)</p>
            <p className="text-sm text-muted-foreground">Date: {format(new Date(req.date), 'MMM dd, yyyy')}</p>
            <p className="text-sm text-muted-foreground">Time: {req.fromTime} to {req.toTime}</p>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Approval Center</h1>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-card-foreground mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-warning" /> Pending Approvals
        </h2>
        
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl w-full"></div>)}
          </div>
        ) : data?.approvals?.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-border rounded-2xl">
            <CheckCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-muted-foreground">All caught up!</h3>
            <p className="text-muted-foreground/80">You have no pending requests to review.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {data?.approvals?.map((req: any) => (
              <div key={req._id} className="p-5 bg-muted/30 rounded-xl border border-border flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-primary/50 transition-colors">
                <div className="w-full">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="font-bold text-card-foreground">{req.employee?.name}</span>
                    <span className="text-xs text-muted-foreground">({req.employee?.employeeId})</span>
                    <span className="px-2 py-0.5 text-[10px] sm:text-xs font-bold bg-primary/10 text-primary rounded-full border border-primary/20 whitespace-nowrap">
                      {req.requestType.replace('_', ' ')}
                    </span>
                  </div>
                  {renderDetails(req)}
                  <p className="text-sm text-card-foreground mt-3"><span className="text-muted-foreground font-medium">Reason:</span> {req.reason}</p>
                </div>
                
                <div className="flex w-full sm:w-auto items-center gap-3 mt-4 sm:mt-0">
                  <button
                    onClick={() => handleAction(req._id, req.requestType, 'approved', req.date || req.currentCheckIn || req.requestedCheckIn)}
                    disabled={acting === req._id}
                    className="flex-1 sm:flex-none justify-center px-4 py-2 min-h-[44px] bg-success/10 text-success hover:bg-success/20 border border-success/20 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => handleAction(req._id, req.requestType, 'rejected')}
                    disabled={acting === req._id}
                    className="flex-1 sm:flex-none justify-center px-4 py-2 min-h-[44px] bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
