'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { format, subMonths, isSameDay } from 'date-fns';
import { Clock, Calendar as CalendarIcon, Filter, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

import { toast } from 'react-hot-toast';
import { api } from '@/services/api';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    error.message = await res.json().catch(() => ({ message: 'API Error' })).then(data => data.message || 'API Error');
    throw error;
  }
  return res.json();
};

export default function EmployeeAttendanceClient() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const { data, error, isLoading, mutate } = useSWR(`/api/employee/attendance?month=${month}&year=${year}`, fetcher);
  const attendances = data?.attendances || [];

  const months = Array.from({ length: 12 }).map((_, i) => subMonths(new Date(), i));

  // Calculate summary stats
  const presentCount = attendances.filter((a: any) => a.status === 'present').length;
  const lateCount = attendances.filter((a: any) => a.status === 'late').length;
  const halfDayCount = attendances.filter((a: any) => a.status === 'half-day').length;

    const getStatusBadge = (att: any) => {
    const status = typeof att === 'string' ? att : att?.status;
    const fh = typeof att === 'object' ? att?.firstHalf : null;
    const sh = typeof att === 'object' ? att?.secondHalf : null;

    let subBadge = null;
    if (fh?.status === 'leave') {
      subBadge = <div className="text-[10px] font-bold text-amber-500 mt-1">1st Half: {fh.leaveType || 'Leave'}</div>;
    } else if (sh?.status === 'leave') {
      subBadge = <div className="text-[10px] font-bold text-amber-500 mt-1">2nd Half: {sh.leaveType || 'Leave'}</div>;
    }

    switch (status) {
      case 'present': return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-success/10 text-success border border-success/20 rounded-md flex items-center w-fit"><CheckCircle2 className="w-3 h-3 mr-1.5" /> Present</span>;
      case 'late': return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-warning/10 text-warning border border-warning/20 rounded-md flex items-center w-fit"><AlertCircle className="w-3 h-3 mr-1.5" /> Late</span>;
      case 'half-day': return (
        <div>
          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 rounded-md flex items-center w-fit"><Clock className="w-3 h-3 mr-1.5" /> Half Day</span>
          {subBadge}
        </div>
      );
      default: return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-destructive/10 text-destructive border border-destructive/20 rounded-md flex items-center w-fit"><XCircle className="w-3 h-3 mr-1.5" /> Absent</span>;
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [requestType, setRequestType] = useState('MISS_PUNCH');
  const [subType, setSubType] = useState('Forgot Check In');
  const [requestDate, setRequestDate] = useState('');
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [reqCheckIn, setReqCheckIn] = useState('');
  const [reqCheckOut, setReqCheckOut] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isModalOpen && data?.user?.shiftId?.sessions?.length > 0) {
      const sessions = [...data.user.shiftId.sessions].sort((a: any, b: any) => a.order - b.order);
      if (!reqCheckIn) setReqCheckIn(sessions[0].startTime);
      if (!reqCheckOut) setReqCheckOut(sessions[sessions.length - 1].endTime);
    }
  }, [isModalOpen, data]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Build date objects for requested times
      let requestedCheckIn, requestedCheckOut;
      if (reqCheckIn) {
        requestedCheckIn = new Date(`${requestDate}T${reqCheckIn}:00`);
      }
      if (reqCheckOut) {
        requestedCheckOut = new Date(`${requestDate}T${reqCheckOut}:00`);
      }

      const res = await api('/api/requests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType,
          date: requestDate,
          reason,
          requestTypeSubType: subType,
          requestedCheckIn,
          requestedCheckOut,
          attendanceId
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit request');
      toast.success('Request submitted successfully');
      setIsModalOpen(false);
      mutate();
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error('An unknown error occurred');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Attendance History</h1>
          <p className="text-sm text-muted-foreground mt-1">View your daily logs and monthly summaries.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={() => {
              setAttendanceId(null);
              setRequestDate('');
              setRequestType('MISS_PUNCH');
              setSubType('Forgot Check In');
              setReqCheckIn('');
              setReqCheckOut('');
              setReason('');
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-xl transition-all shadow-lg shadow-primary/20 whitespace-nowrap min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Request Correction
          </button>
          <div className="relative flex-1 sm:flex-none">
            <Filter className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select 
              className="w-full sm:w-auto bg-card border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent shadow-sm min-h-[44px] appearance-none"
              onChange={(e) => setCurrentDate(new Date(e.target.value))}
              value={currentDate.toISOString()}
              aria-label="Select month"
            >
              {months.map((m, i) => (
                <option key={i} value={m.toISOString()}>{format(m, 'MMMM yyyy')}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm flex items-center">
          <div className="rounded-lg p-3 bg-green-500/10 mr-4">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <div className="text-sm text-neutral-400 font-medium">Full Days Present</div>
            <div className="text-2xl font-bold text-white">{presentCount}</div>
          </div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm flex items-center">
          <div className="rounded-lg p-3 bg-amber-500/10 mr-4">
            <AlertCircle className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <div className="text-sm text-neutral-400 font-medium">Late Marks</div>
            <div className="text-2xl font-bold text-white">{lateCount}</div>
          </div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm flex items-center">
          <div className="rounded-lg p-3 bg-blue-500/10 mr-4">
            <Clock className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <div className="text-sm text-neutral-400 font-medium">Half Days</div>
            <div className="text-2xl font-bold text-white">{halfDayCount}</div>
          </div>
        </div>
      </div> */}

      <div className="bg-card backdrop-blur border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-muted/30">
          <h2 className="text-lg font-bold text-card-foreground flex items-center">
            <CalendarIcon className="w-5 h-5 mr-2 text-primary" />
            {format(currentDate, 'MMMM yyyy')} Log
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Date</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Check In</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Check Out</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Work Hours</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Extra</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Available</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Used</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                <th scope="col" className="px-6 py-4 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Action / Status</th>
              </tr>
            </thead>
            <tbody className="bg-transparent divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="h-4 w-1/3 bg-muted animate-pulse rounded"></div>
                      <div className="h-4 w-1/2 bg-muted animate-pulse rounded"></div>
                      <div className="h-4 w-1/4 bg-muted animate-pulse rounded"></div>
                    </div>
                  </td>
                </tr>
              ) : attendances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <CalendarIcon className="w-10 h-10 mb-3 opacity-20" />
                      <p className="text-sm font-medium">No attendance records found for this month.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                attendances.map((att: any) => {
                  const used = (att.totalExtraMinutes || 0) - (att.availableExtraMinutes || 0);
                  return (
                  <tr key={att._id} className="hover:bg-accent hover:text-accent-foreground transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-card-foreground group-hover:text-accent-foreground">{format(new Date(att.date), 'MMM dd, yyyy')}</div>
                      <div className="text-[10px] font-bold text-muted-foreground group-hover:text-accent-foreground/70 uppercase tracking-wider mt-0.5">{format(new Date(att.date), 'EEEE')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground group-hover:text-accent-foreground/80 font-mono">
                      {att.loginTime ? format(new Date(att.loginTime), 'HH:mm') : '--:--'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground group-hover:text-accent-foreground/80 font-mono">
                      {att.logoutTime ? format(new Date(att.logoutTime), 'HH:mm') : '--:--'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground group-hover:text-accent-foreground/80 font-medium font-mono">
                      {att.totalHours ? `${Math.floor(att.totalHours)}.${Math.round((att.totalHours % 1) * 60).toString().padStart(2, '0')} hrs` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-primary font-bold font-mono">
                      {att.totalExtraMinutes ? `${Math.floor(att.totalExtraMinutes / 60)}h ${att.totalExtraMinutes % 60}m` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-success font-bold font-mono">
                      {att.availableExtraMinutes ? `${Math.floor(att.availableExtraMinutes / 60)}h ${att.availableExtraMinutes % 60}m` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-warning font-bold font-mono">
                      {used > 0 ? `${Math.floor(used / 60)}h ${used % 60}m` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(att)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {att.correctionStatus === 'pending' ? (
                        <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-warning/10 text-warning border border-warning/20 rounded-md">
                          <Clock className="w-3 h-3 mr-1.5 animate-pulse" /> Requested
                        </span>
                      ) : att.correctionStatus === 'approved' ? (
                        <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-success/10 text-success border border-success/20 rounded-md">
                          <CheckCircle2 className="w-3 h-3 mr-1.5" /> Corrected
                        </span>
                      ) : att.correctionStatus === 'rejected' ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
                            <XCircle className="w-3 h-3 mr-1.5" /> Rejected
                          </span>
                          <button 
                            onClick={() => {
                              setRequestDate(format(new Date(att.date), 'yyyy-MM-dd'));
                              setAttendanceId(att._id);
                              setIsModalOpen(true);
                              setRequestType('ATTENDANCE_CORRECTION');
                            }}
                            className="text-foreground hover:bg-primary px-2.5 py-1 text-xs rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring opacity-100"
                            aria-label={`Request correction again for ${format(new Date(att.date), 'MMM dd, yyyy')}`}
                          >
                            Request Again
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => {
                            setRequestDate(format(new Date(att.date), 'yyyy-MM-dd'));
                            setAttendanceId(att._id);
                            setIsModalOpen(true);
                            setRequestType('ATTENDANCE_CORRECTION');
                          }}
                          className="text-foreground hover:bg-primary px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
                          aria-label={`Request correction for ${format(new Date(att.date), 'MMM dd, yyyy')}`}
                        >
                          Request 
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 id="modal-title" className="text-lg font-bold text-card-foreground">Request Correction</h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close modal"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1.5">Request Type</label>
                <select 
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors min-h-[44px]"
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value)}
                >
                  <option value="MISS_PUNCH">Miss Punch (Forgot Check In/Out)</option>
                  <option value="ATTENDANCE_CORRECTION">Attendance Correction (Late Check In)</option>
                </select>
              </div>

              {requestType === 'MISS_PUNCH' && (
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">Sub Type</label>
                  <select 
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors min-h-[44px]"
                    value={subType}
                    onChange={(e) => setSubType(e.target.value)}
                  >
                    <option value="Forgot Check In">Forgot Check In</option>
                    <option value="Forgot Check Out">Forgot Check Out</option>
                    <option value="Missed Both">Missed Both</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1.5">Date</label>
                <input 
                  type="date" 
                  required
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors min-h-[44px]"
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">Requested Check In</label>
                  <input 
                    type="time" 
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors min-h-[44px]"
                    value={reqCheckIn}
                    onChange={(e) => setReqCheckIn(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">Requested Check Out</label>
                  <input 
                    type="time" 
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors min-h-[44px]"
                    value={reqCheckOut}
                    onChange={(e) => setReqCheckOut(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1.5">Reason / Explanation</label>
                <textarea 
                  required
                  rows={3}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why you are requesting this correction..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-2 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-secondary-foreground bg-secondary hover:bg-secondary/80 rounded-xl transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-xl disabled:opacity-50 transition-colors shadow-lg shadow-primary/20 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
