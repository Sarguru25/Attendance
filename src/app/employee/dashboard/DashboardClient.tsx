'use client';

import { Clock, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import useSWR from 'swr';
import { format } from 'date-fns';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import ReportingStructure from './ReportingStructure';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    error.message = await res.json().catch(() => ({ message: 'API Error' })).then(data => data.message || 'API Error');
    throw error;
  }
  return res.json();
};

export default function EmployeeDashboardClient() {
  const router = useRouter();
  const { data, error, isLoading } = useSWR('/api/employee/dashboard', fetcher, {
    refreshInterval: 60000, // 1 minute is sufficient for attendance dashboard
  });

  const { data: holidaysData, isLoading: isLoadingHolidays } = useSWR('/api/holidays', fetcher);

  if (error) return <div className="text-red-500">Failed to load dashboard data</div>;

  const getShiftDisplay = () => {
    if (!data?.shift) return 'No Shift Assigned';
    return `${data.shift.shiftName} (${data.shift.startTime} - ${data.shift.endTime})`;
  };

  const getStatusDisplay = () => {
    if (!data?.todayAttendance) return 'Not Checked In';
    return data.todayAttendance.status.charAt(0).toUpperCase() + data.todayAttendance.status.slice(1);
  };

  const stats = [
    { name: 'Today Attendance', value: isLoading ? '...' : getStatusDisplay(), icon: Clock, color: 'text-primary', bg: 'bg-primary/10' },
    { name: 'Monthly Attendance', value: isLoading ? '...' : `${data?.attendancePercentage ?? 0}% (${data?.presentDays ?? 0}/${data?.workingDays ?? 0} Days)`, icon: Calendar, color: 'text-primary', bg: 'bg-primary/10' },
    { name: 'Casual Leaves (Available / Used)', value: isLoading ? '...' : `${data?.rawLeaveBalance?.casualLeave?.available ?? 0} / ${data?.rawLeaveBalance?.casualLeave?.taken ?? 0}`, icon: FileText, color: 'text-primary', bg: 'bg-primary/10' },
    { name: 'Sick Leaves (Available / Used)', value: isLoading ? '...' : `${data?.rawLeaveBalance?.sickLeave?.available ?? 0} / ${data?.rawLeaveBalance?.sickLeave?.taken ?? 0}`, icon: FileText, color: 'text-primary', bg: 'bg-primary/10' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard Overview</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar */}
        <div className="lg:col-span-4 xl:col-span-3">
          <ReportingStructure
            manager={data?.manager}
            currentUser={data?.currentUser}
            subordinates={data?.subordinates}
            isLoading={isLoading}
            todayAttendance={data?.todayAttendance}
            sessionStatus={data?.sessionStatus}
            activeSessionInfo={data?.activeSessionInfo}
          />
        </div>

        {/* Right Main Content */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-1 xl:grid-cols-2">
            {stats.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.name}
                  className="relative overflow-hidden rounded-2xl bg-card border border-border p-6 shadow-sm hover:shadow-md hover:border-primary/50 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`rounded-xl p-3.5 ${item.bg} group-hover:scale-110 transition-transform`}>
                      <Icon className={`h-6 w-6 ${item.color}`} aria-hidden="true" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="truncate text-sm font-medium text-muted-foreground">{item.name}</dt>
                        <dd>
                          <div className="text-lg font-bold text-card-foreground">{item.value}</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-2xl shadow-sm p-6 flex flex-col h-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-card-foreground">Recent Attendance</h2>
                <div className="flex items-center space-x-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                  </span>
                  <span className="text-xs text-muted-foreground">Live</span>
                </div>
              </div>
              <div className="space-y-4 flex-1">
                {isLoading ? (
                  <div className="space-y-3" aria-busy="true" aria-label="Loading recent attendance">
                    {[1, 2, 3].map(i => <div key={i} className="h-[68px] bg-muted animate-pulse rounded-xl w-full border border-border"></div>)}
                  </div>
                ) : data?.recentAttendances?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
                    <Clock className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">No recent attendance</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data?.recentAttendances?.map((att: { date: string, status: string, loginTime?: string, logoutTime?: string }, i: number) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-muted/30 rounded-xl gap-3 border border-border hover:bg-accent hover:text-accent-foreground transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={clsx("flex items-center justify-center w-10 h-10 rounded-lg shadow-inner", 
                            att.status === 'present' ? 'bg-success/10 text-success' : 
                            att.status === 'late' ? 'bg-warning/10 text-warning' : 
                            'bg-destructive/10 text-destructive'
                          )}>
                             {att.status === 'present' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                          </div>
                          <div>
                            <span className="text-sm font-bold text-card-foreground block">{format(new Date(att.date), 'MMM dd, yyyy')}</span>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{format(new Date(att.date), 'EEEE')}</span>
                          </div>
                        </div>
                        <div className="flex sm:flex-col sm:items-end gap-2 text-sm text-muted-foreground">
                          <div className="flex gap-3 text-xs bg-background px-2.5 py-1.5 rounded-lg border border-border font-mono">
                            <span>In: {att.loginTime ? format(new Date(att.loginTime), 'HH:mm') : '--:--'}</span>
                            <span className="text-muted-foreground">|</span>
                            <span>Out: {att.logoutTime ? format(new Date(att.logoutTime), 'HH:mm') : '--:--'}</span>
                          </div>
                          <span className={`px-2 py-0.5 w-max rounded-md text-[10px] uppercase font-bold tracking-wider border ${att.status === 'present' ? 'text-success bg-success/10 border-success/20' :
                            att.status === 'late' ? 'text-warning bg-warning/10 border-warning/20' :
                              'text-destructive bg-destructive/10 border-destructive/20'
                            }`}>
                            {att.status.replace('-', ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>



            <div className="bg-card border border-border rounded-2xl shadow-sm p-6 lg:col-span-1 flex flex-col h-full">
              <h2 className="text-lg font-medium text-card-foreground mb-4">Upcoming Holidays</h2>
              <div className="flex-1">
                {isLoadingHolidays ? (
                  <div className="space-y-3" aria-busy="true" aria-label="Loading holidays">
                    {[1, 2, 3].map(i => <div key={i} className="h-[74px] bg-muted animate-pulse rounded-xl w-full border border-border"></div>)}
                  </div>
                ) : holidaysData?.holidays?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
                    <Calendar className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No upcoming holidays</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {holidaysData?.holidays?.slice(0, 5).map((holiday: { _id: string, date: string, holidayName: string, holidayType: string }) => {
                      const colors = {
                        public: 'bg-destructive/10 text-destructive border-destructive/20',
                        restricted: 'bg-warning/10 text-warning border-warning/20',
                        company: 'bg-primary/10 text-primary border-primary/20',
                        'half-day': 'bg-primary/10 text-primary border-primary/20',
                        'working-day': 'bg-success/10 text-success border-success/20',
                      };

                      return (
                        <div key={holiday._id} className="flex items-center justify-between p-3.5 bg-muted/30 rounded-xl border border-border hover:bg-accent hover:text-accent-foreground transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center justify-center h-12 w-12 rounded-xl bg-background text-foreground shadow-inner border border-border">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{format(new Date(holiday.date), 'MMM')}</span>
                              <span className="text-lg font-bold leading-none">{format(new Date(holiday.date), 'dd')}</span>
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-card-foreground">{holiday.holidayName}</h3>
                              <p className="text-xs font-medium text-muted-foreground mt-0.5 uppercase tracking-wider">{format(new Date(holiday.date), 'EEEE')}</p>
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider border ${colors[holiday.holidayType as keyof typeof colors] || colors.public}`}>
                            {holiday.holidayType.replace('-', ' ')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-sm p-6 lg:col-span-2">
              <h2 className="text-lg font-medium text-card-foreground mb-4">Upcoming Leaves</h2>
              {isLoading ? (
                <div className="h-48 bg-muted animate-pulse rounded-xl w-full border border-border" aria-busy="true"></div>
              ) : data?.upcomingLeaves?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
                  <Calendar className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No upcoming leaves scheduled.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data?.upcomingLeaves?.map((leave: { _id: string, leaveType: string, fromDate: string, toDate: string, status: string }) => (
                    <div key={leave._id} className="p-4 bg-muted/30 rounded-xl border border-border hover:bg-accent transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-sm font-bold text-card-foreground">{leave.leaveType}</h3>
                          <p className="text-xs font-medium text-muted-foreground mt-1 uppercase tracking-wider">{format(new Date(leave.fromDate), 'MMM dd, yyyy')} - {format(new Date(leave.toDate), 'MMM dd, yyyy')}</p>
                        </div>
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider border ${leave.status === 'approved' ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'
                          }`}>
                          {leave.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button 
                onClick={() => router.push('/employee/leaves?apply=true')}
                className="mt-6 px-4 py-3 min-h-[44px] w-full text-sm font-bold bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background border border-border">
                Apply for Leave
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
 