  'use client';

import { User as UserIcon, Loader2, AlertTriangle, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import { mutate } from 'swr';
import { api } from '@/services/api';

interface Employee {
  employeeId: string;
  name: string;
  designation?: string;
  profileImage?: string;
  status?: string;
}

interface AttendanceData {
  status: string;
  loginTime?: string;
  logoutTime?: string;
  sessions?: any[];
}

interface ReportingStructureProps {
  manager: Employee | null;
  currentUser: Employee | null;
  subordinates: Employee[] | null;
  isLoading: boolean;
  todayAttendance: AttendanceData | null;
  sessionStatus?: string;
  activeSessionInfo?: any;
}

const Avatar = ({ src, alt, size = "md" }: { src?: string, alt?: string, size?: "sm" | "md" | "lg" }) => {
  const dimensions = {
    sm: "w-10 h-10",
    md: "w-12 h-12",
    lg: "w-24 h-24"
  };

  return (
    <div className={clsx(dimensions[size], "relative rounded-full overflow-hidden bg-muted border-2 border-border flex items-center justify-center flex-shrink-0")}>
      {src ? (
        <Image 
          src={src} 
          alt={alt || 'User profile'} 
          fill 
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover" 
        />
      ) : (
        <UserIcon className={clsx("text-muted-foreground", size === 'lg' ? 'w-12 h-12' : 'w-6 h-6')} />
      )}
    </div>
  );
};

// Confirmation Modal Component
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, isLoading }: any) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="bg-card border border-border rounded-xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4 text-warning">
          <AlertTriangle className="w-6 h-6" />
          <h3 id="modal-title" className="text-lg font-semibold text-card-foreground">{title}</h3>
        </div>
        <p className="text-muted-foreground text-sm mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button 
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-secondary-foreground bg-secondary hover:bg-secondary/80 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors flex items-center min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ReportingStructure({ manager, currentUser, subordinates, isLoading, todayAttendance, sessionStatus, activeSessionInfo }: ReportingStructureProps) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState('00 : 00 : 00');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'check-in' | 'check-out' | null>(null);

  useEffect(() => {
    const calculateTotalWorkedMs = () => {
      let total = 0;
      if (todayAttendance?.sessions) {
        todayAttendance.sessions.forEach((s: any) => {
          if (s.checkIn && s.checkOut) {
            total += new Date(s.checkOut).getTime() - new Date(s.checkIn).getTime();
          }
        });
      }
      return total;
    };

    const baseMs = calculateTotalWorkedMs();

    if (sessionStatus !== 'CAN_CHECK_OUT' || !activeSessionInfo?.sessionState?.checkIn) {
      const hours = Math.floor(baseMs / (1000 * 60 * 60)).toString().padStart(2, '0');
      const mins = Math.floor((baseMs % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
      const secs = Math.floor((baseMs % (1000 * 60)) / 1000).toString().padStart(2, '0');
      setElapsed(`${hours} : ${mins} : ${secs}`);
      return;
    }

    const login = new Date(activeSessionInfo.sessionState.checkIn).getTime();
    
    const updateTimer = () => {
      const now = Date.now();
      const currentSessionMs = Math.max(0, now - login);
      const totalMs = baseMs + currentSessionMs;

      const hours = Math.floor(totalMs / (1000 * 60 * 60)).toString().padStart(2, '0');
      const mins = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
      const secs = Math.floor((totalMs % (1000 * 60)) / 1000).toString().padStart(2, '0');

      setElapsed(`${hours} : ${mins} : ${secs}`);
    };
    
    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [sessionStatus, activeSessionInfo, todayAttendance]);

  const executeAttendanceAction = async () => {
    if (!confirmAction) return;

    setIsActionLoading(true);
    const toastId = toast.loading(`${confirmAction === 'check-in' ? 'Checking in' : 'Checking out'}...`);

    try {
      const res = await api(`/api/attendance/${confirmAction}`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Action failed', { id: toastId });
      } else {
        toast.success(data.message || `Successfully ${confirmAction.replace('-', ' ')}ed`, { id: toastId });
        await mutate('/api/employee/dashboard');
        router.refresh();
      }
    } catch (error) {
      toast.error('Network error occurred', { id: toastId });
    } finally {
      setIsActionLoading(false);
      setConfirmAction(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading profile data">
        <div className="h-72 bg-muted animate-pulse rounded-2xl border border-border w-full"></div>
        <div className="h-28 bg-muted animate-pulse rounded-2xl border border-border w-full"></div>
        <div className="h-40 bg-muted animate-pulse rounded-2xl border border-border w-full"></div>
      </div>
    );
  }

  const getStatus = (node: Employee) => {
    return "Active";
  };

  return (
    <div className="w-full sm:max-w-sm lg:max-w-none mx-auto space-y-6 font-sans relative">
      <ConfirmModal 
        isOpen={!!confirmAction}
        title={confirmAction === 'check-in' ? "Confirm Check In" : "Confirm Check Out"}
        message={`Are you sure you want to ${confirmAction?.replace('-', ' ')}? Make sure your location is correct.`}
        isLoading={isActionLoading}
        onConfirm={executeAttendanceAction}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Background decoration */}
      <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-primary/20 to-transparent rounded-t-2xl -z-10 pointer-events-none"></div>

      {/* 1. Main Profile Card */}
      <div className="bg-secondary rounded-2xl shadow-lg border border-border p-6 pt-16 relative flex flex-col items-center mt-14 group transition-all hover:border-primary/50">
        <div className="absolute -top-14 left-1/2 -translate-x-1/2 p-2 bg-amber-gold-200 rounded-full shadow-xl">
          <Avatar src={currentUser?.profileImage} alt={currentUser?.name} size="lg" />
        </div>

        <h3 className="text-secondary-foreground font-bold text-lg tracking-tight text-center">
          {currentUser?.name || 'Employee Name'}
        </h3>
        <p className="text-foreground text-sm font-medium mt-1 flex items-center gap-2">
          <span className="bg-primary font-bold px-2 py-0.5 rounded text-sm text-primary-foreground border border-border">{currentUser?.employeeId || 'ID'}</span>
          {currentUser?.designation || 'Employee'}
        </p>

        <div className="mt-6 w-full flex flex-col items-center bg-background/50 rounded-xl p-4 border border-border">
          <p className="text-sm font-medium mb-2 text-muted-foreground uppercase tracking-widest text-[10px]">Current Session Status</p>
          <div className="flex items-center gap-2 mb-3">
             <span className={clsx("relative flex h-3 w-3", sessionStatus === 'CAN_CHECK_OUT' ? "flex" : "hidden")}>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
             </span>
             <p className={clsx("text-sm font-bold", 
               sessionStatus === 'CAN_CHECK_OUT' ? "text-success" : "text-muted-foreground"
             )}>
               {sessionStatus === 'CAN_CHECK_IN' ? 'Check In Available' : 
                sessionStatus === 'CAN_CHECK_OUT' ? 'Checked In' : 
                sessionStatus === 'ALL_COMPLETED' ? 'Session Completed' :
                sessionStatus === 'NO_ACTIVE_SESSION' ? 'No Active Session' : 'Not Available'}
             </p>
          </div>

          <div className="flex gap-1.5 items-center justify-center font-mono" aria-label="Timer">
            {elapsed.split(' : ').map((part, i, arr) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="bg-card shadow-inner border border-border text-card-foreground px-3 py-2 rounded-lg text-xl font-bold tracking-wider">{part}</span>
                {i < arr.length - 1 && <span className="text-muted-foreground font-bold mb-1">:</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 w-full text-center mb-2">
          {activeSessionInfo?.activeSession && (
            <p className="text-xs font-bold text-muted-foreground mb-2">
              Active Session: {activeSessionInfo.activeSession.startTime} - {activeSessionInfo.activeSession.endTime}
            </p>
          )}
          {!activeSessionInfo?.activeSession && activeSessionInfo?.nextSession && (
            <p className="text-xs font-bold text-muted-foreground mb-2">
              Next Session: {activeSessionInfo.nextSession.startTime}
            </p>
          )}
        </div>

        <div className="mt-2 w-full">
          {sessionStatus === 'CAN_CHECK_IN' ? (
            <button
              disabled={isActionLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 py-3.5 rounded-xl font-bold transition-all text-sm flex items-center justify-center disabled:opacity-50 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              onClick={() => setConfirmAction('check-in')}
            >
              {isActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Check In Now'}
            </button>
          ) : sessionStatus === 'CAN_CHECK_OUT' ? (
            <button
              disabled={isActionLoading}
              className="w-full bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 py-3.5 rounded-xl font-bold transition-all text-sm flex items-center justify-center disabled:opacity-50 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              onClick={() => setConfirmAction('check-out')}
            >
              {isActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Check Out'}
            </button>
          ) : (
            <div className="w-full bg-muted border border-border text-muted-foreground py-3.5 rounded-xl font-medium text-sm flex items-center justify-center cursor-not-allowed">
              {sessionStatus === 'ALL_COMPLETED' ? 'Shift Completed' : 'Action Unavailable'}
            </div>
          )}
        </div>
      </div>

      {/* 2. Reporting Manager Card */}
      <div className="bg-card rounded-2xl shadow-sm border border-border p-5 hover:border-primary/50 transition-colors">
        <h4 className="text-muted-foreground uppercase tracking-wider text-[11px] font-bold mb-4">Reporting Manager</h4>
        {manager ? (
          <div className="flex items-center gap-4">
            <Avatar src={manager.profileImage} alt={manager.name} />
            <div>
              <p className="text-card-foreground text-sm font-bold">
                {manager.name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                 <span className="text-muted-foreground text-xs font-medium bg-muted px-1.5 py-0.5 rounded border border-border">{manager.employeeId}</span>
                 <p className="text-success text-xs font-medium">{getStatus(manager)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center p-4 border border-dashed border-border rounded-xl bg-muted/30">
            <p className="text-muted-foreground text-sm">Directly reports to Admin</p>
          </div>
        )}
      </div>

      {/* 3. Department Members / Subordinates Card */}
      <div 
        onClick={() => router.push('/employee/my-team')}
        className="bg-card rounded-2xl shadow-sm border border-border p-5 hover:border-primary/50 transition-colors cursor-pointer group/card"
      >
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-muted-foreground uppercase tracking-wider text-[11px] font-bold">
            Reporting to Me <span className="bg-primary text-primary-foreground ml-2 px-2 py-0.5 rounded-full text-[10px]">{subordinates?.length || 0}</span>
          </h4>
          <span className="text-primary text-[10px] uppercase font-bold tracking-wider opacity-0 group-hover/card:opacity-100 transition-opacity">View All →</span>
        </div>
        <div className="space-y-4">
          {subordinates && subordinates.length > 0 ? (
            subordinates.map((sub, idx) => (
              <div key={idx} className="flex items-center gap-4 group">
                <Avatar src={sub.profileImage} alt={sub.name} size="sm" />
                <div className="flex-1">
                  <p className="text-card-foreground text-sm font-bold group-hover:text-primary transition-colors">
                    {sub.name}
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5 truncate">{sub.designation || 'Employee'}</p>
                </div>
                <div className="text-right">
                  <p className="text-success text-[10px] uppercase font-bold tracking-wider bg-success/10 px-2 py-1 rounded-md">{getStatus(sub)}</p>
                </div>
              </div>
            ))
          ) : (
             <div className="flex items-center justify-center p-4 border border-dashed border-border rounded-xl bg-muted/30">
                <p className="text-muted-foreground text-sm">No team members</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
