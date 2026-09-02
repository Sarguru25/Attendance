'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  startOfWeek,
  endOfWeek
} from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon, User as UserIcon, Download, Clock } from 'lucide-react';
import clsx from 'clsx';
import * as ExcelJS from 'exceljs';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Props {
  userId?: string;
  isAdmin?: boolean;
}

const LEAVE_TYPES = [
  'Casual Leave',
  'Sick Leave',
  'Compensatory Off',
  'Restricted Holiday',
  'Maternity Leave',
  'Paternity Leave',
  'Leave Without Pay'
];

export default function AttendanceCalendar({ userId, isAdmin = false }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedUser, setSelectedUser] = useState<string | undefined>(userId);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const [editData, setEditData] = useState<any>({
    status: 'present',
    duration: 'full_day',
    halfDaySession: 'first_half',
    firstHalfStatus: 'present',
    firstHalfLeaveType: 'Casual Leave',
    firstHalfIn: '',
    firstHalfOut: '',
    secondHalfStatus: 'present',
    secondHalfLeaveType: 'Casual Leave',
    secondHalfIn: '',
    secondHalfOut: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // Fetch employees list if admin
  const { data: employeesData } = useSWR(isAdmin ? '/api/admin/employees' : null, fetcher);
  const [isExporting, setIsExporting] = useState(false);

  const monthStr = format(currentDate, 'yyyy-MM');
  const queryUrl = selectedUser
    ? `/api/calendar?month=${monthStr}&userId=${selectedUser}`
    : `/api/calendar?month=${monthStr}`;

  const { data, error, isLoading, mutate } = useSWR(queryUrl, fetcher);

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const daysInMonth = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const getDayDetails = (day: Date) => {
    if (!data || data.error) return null;

    // 1. Check Holiday
    const holiday = data.holidays?.find((h: any) => isSameDay(new Date(h.date), day));
    if (holiday) {
      return {
        isHoliday: true,
        label: holiday.holidayName,
        color: 'bg-primary/10 text-primary border-primary/20'
      };
    }

    // 2. Check Weekend / Weekly Off
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;

    // 3. Attendance and Leave records
    const attendance = data.attendances?.find((a: any) => isSameDay(new Date(a.date), day));
    const leave = data.leaves?.find((l: any) => {
      const from = new Date(l.fromDate);
      const to = new Date(l.toDate);
      from.setHours(0, 0, 0, 0);
      to.setHours(0, 0, 0, 0);
      const current = new Date(day);
      current.setHours(0, 0, 0, 0);
      return current >= from && current <= to;
    });

    const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
    const isBeforeJoining = data.user?.joiningDate && day < new Date(new Date(data.user.joiningDate).setHours(0, 0, 0, 0));

    if (isWeekend && !attendance && !leave) {
      return {
        isWeeklyOff: true,
        label: 'Weekly Off',
        color: 'bg-muted/30 text-muted-foreground border-transparent'
      };
    }

    if (isBeforeJoining && !attendance && !leave) {
      return {
        isBeforeJoining: true,
        label: '-',
        color: 'bg-muted/20 text-muted-foreground border-transparent'
      };
    }

    const getStyle = (type: string) => {
      switch (type) {
        case 'present':
          return 'bg-success/10 text-success border-success/30';
        case 'late':
          return 'bg-warning/15 text-warning border-warning/30';
        case 'leave':
          return 'bg-warning/15 text-warning border-warning/30';
        case 'absent':
          return 'bg-destructive/10 text-destructive border-destructive/30';
        default:
          return 'bg-muted/40 text-muted-foreground border-border';
      }
    };

    // FIRST HALF
    let firstHalf: any = { label: 'Absent', color: getStyle('absent') };

    if (leave && (leave.duration === 'full_day' || leave.halfDaySession === 'first_half')) {
      firstHalf = { label: leave.leaveType || 'Leave', color: getStyle('leave') };
    } else if (attendance?.firstHalf?.status === 'leave') {
      firstHalf = { label: attendance.firstHalf.leaveType || 'Leave', color: getStyle('leave') };
    } else if (attendance?.firstHalf?.status === 'present' || attendance?.firstHalf?.status === 'late' || attendance?.firstHalf?.checkIn || attendance?.sessions?.[0]?.checkIn || (attendance?.loginTime && (!leave || leave.halfDaySession === 'second_half') && attendance?.status !== 'absent')) {
      const isLate = attendance?.firstHalf?.status === 'late' || (attendance?.sessions?.[0]?.lateMinutes > 0);
      const lateMins = attendance?.firstHalf?.lateMinutes || attendance?.sessions?.[0]?.lateMinutes;
      firstHalf = {
        label: isLate ? `Late ${lateMins ? `(${lateMins}m)` : ''}` : 'Present',
        color: getStyle(isLate ? 'late' : 'present')
      };
    } else if (attendance?.firstHalf?.status === 'absent' || attendance?.status === 'absent') {
      firstHalf = { label: 'Absent', color: getStyle('absent') };
    } else if (!isPast && !attendance) {
      firstHalf = { label: '-', color: getStyle('none') };
    }

    // SECOND HALF
    let secondHalf: any = { label: 'Absent', color: getStyle('absent') };

    if (leave && (leave.duration === 'full_day' || leave.halfDaySession === 'second_half')) {
      secondHalf = { label: leave.leaveType || 'Leave', color: getStyle('leave') };
    } else if (attendance?.secondHalf?.status === 'leave') {
      secondHalf = { label: attendance.secondHalf.leaveType || 'Leave', color: getStyle('leave') };
    } else if (attendance?.secondHalf?.status === 'present' || attendance?.secondHalf?.status === 'late' || attendance?.secondHalf?.checkIn || attendance?.sessions?.[1]?.checkIn) {
      const isLate = attendance?.secondHalf?.status === 'late' || (attendance?.sessions?.[1]?.lateMinutes > 0);
      const lateMins = attendance?.secondHalf?.lateMinutes || attendance?.sessions?.[1]?.lateMinutes;
      secondHalf = {
        label: isLate ? `Late ${lateMins ? `(${lateMins}m)` : ''}` : 'Present',
        color: getStyle(isLate ? 'late' : 'present')
      };
    } else if (attendance?.secondHalf?.status === 'absent' || attendance?.status === 'absent') {
      secondHalf = { label: 'Absent', color: getStyle('absent') };
    } else if (!isPast && !attendance) {
      secondHalf = { label: '-', color: getStyle('none') };
    }

    return {
      firstHalf,
      secondHalf
    };
  };

  const handleDayClick = (day: Date, details: any) => {
    if (!isAdmin || !selectedUser) return;

    if (details?.isHoliday) {
      toast.error('Cannot mark attendance on a Public or Company Holiday.');
      return;
    }

    setSelectedDate(day);
    setIsEditModalOpen(true);

    const attendance = data?.attendances?.find((a: any) => isSameDay(new Date(a.date), day));
    const leave = data?.leaves?.find((l: any) => {
      const from = new Date(l.fromDate);
      const to = new Date(l.toDate);
      from.setHours(0, 0, 0, 0);
      to.setHours(0, 0, 0, 0);
      const current = new Date(day);
      current.setHours(0, 0, 0, 0);
      return current >= from && current <= to;
    });

    const fh = attendance?.firstHalf || {};
    const sh = attendance?.secondHalf || {};

    const fhIn = fh.checkIn ? format(new Date(fh.checkIn), 'HH:mm') : (attendance?.sessions?.[0]?.checkIn ? format(new Date(attendance.sessions[0].checkIn), 'HH:mm') : '');
    const fhOut = fh.checkOut ? format(new Date(fh.checkOut), 'HH:mm') : (attendance?.sessions?.[0]?.checkOut ? format(new Date(attendance.sessions[0].checkOut), 'HH:mm') : '');

    const shIn = sh.checkIn ? format(new Date(sh.checkIn), 'HH:mm') : (attendance?.sessions?.[1]?.checkIn ? format(new Date(attendance.sessions[1].checkIn), 'HH:mm') : '');
    const shOut = sh.checkOut ? format(new Date(sh.checkOut), 'HH:mm') : (attendance?.sessions?.[1]?.checkOut ? format(new Date(attendance.sessions[1].checkOut), 'HH:mm') : '');

    const firstStatus = fh.status || (leave && leave.halfDaySession === 'first_half' ? 'leave' : (attendance ? (attendance.status === 'absent' ? 'absent' : 'present') : 'present'));
    const secondStatus = sh.status || (leave && leave.halfDaySession === 'second_half' ? 'leave' : (attendance ? (attendance.status === 'absent' ? 'absent' : 'present') : 'present'));

    setEditData({
      status: attendance?.status || (leave ? leave.leaveType : 'present'),
      duration: leave?.duration || 'full_day',
      halfDaySession: leave?.halfDaySession || 'first_half',
      firstHalfStatus: firstStatus,
      firstHalfLeaveType: fh.leaveType || leave?.leaveType || 'Casual Leave',
      firstHalfIn: fhIn,
      firstHalfOut: fhOut,
      secondHalfStatus: secondStatus,
      secondHalfLeaveType: sh.leaveType || leave?.leaveType || 'Casual Leave',
      secondHalfIn: shIn,
      secondHalfOut: shOut
    });
  };

  const handleSaveEdit = async () => {
    if (!selectedDate || !selectedUser) return;
    setIsSaving(true);

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      const firstHalfPayload = {
        status: editData.firstHalfStatus,
        leaveType: editData.firstHalfStatus === 'leave' ? editData.firstHalfLeaveType : null,
        checkIn: editData.firstHalfIn ? `${dateStr}T${editData.firstHalfIn}:00+05:30` : null,
        checkOut: editData.firstHalfOut ? `${dateStr}T${editData.firstHalfOut}:00+05:30` : null
      };

      const secondHalfPayload = {
        status: editData.secondHalfStatus,
        leaveType: editData.secondHalfStatus === 'leave' ? editData.secondHalfLeaveType : null,
        checkIn: editData.secondHalfIn ? `${dateStr}T${editData.secondHalfIn}:00+05:30` : null,
        checkOut: editData.secondHalfOut ? `${dateStr}T${editData.secondHalfOut}:00+05:30` : null
      };

      const sessionsPayload = [
        { order: 1, checkIn: editData.firstHalfIn, checkOut: editData.firstHalfOut },
        { order: 2, checkIn: editData.secondHalfIn, checkOut: editData.secondHalfOut }
      ];

      let overallStatus = editData.status;
      let duration = editData.duration;
      let halfDaySession = editData.halfDaySession;

      if (overallStatus !== 'none' && overallStatus !== 'clear') {
        const fh = editData.firstHalfStatus;
        const sh = editData.secondHalfStatus;

        if (fh === 'absent' && sh === 'absent') {
          overallStatus = 'absent';
        } else if (fh === 'present' && sh === 'present') {
          overallStatus = 'present';
        } else if (fh === 'leave' && sh === 'leave') {
          overallStatus = editData.firstHalfLeaveType || 'Casual Leave';
          duration = 'full_day';
        } else if (fh === 'leave') {
          overallStatus = editData.firstHalfLeaveType || 'Casual Leave';
          duration = 'half_day';
          halfDaySession = 'first_half';
        } else if (sh === 'leave') {
          overallStatus = editData.secondHalfLeaveType || 'Casual Leave';
          duration = 'half_day';
          halfDaySession = 'second_half';
        } else if ((fh === 'absent' && sh === 'present') || (fh === 'present' && sh === 'absent')) {
          overallStatus = 'half-day';
        }
      }

      const res = await api('/api/admin/attendance/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser,
          date: dateStr,
          status: overallStatus,
          duration,
          halfDaySession,
          sessions: sessionsPayload,
          firstHalf: firstHalfPayload,
          secondHalf: secondHalfPayload
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update attendance');
      }
      toast.success('Attendance updated successfully');
      await mutate();
      setIsEditModalOpen(false);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Error updating attendance');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await api(`/api/admin/calendar/export?month=${monthStr}`);
      if (!res.ok) throw new Error('Failed to fetch export data');
      const exportData = await res.json();

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Monthly Attendance');

      const daysInThisMonth = eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
      });

      const headerRow = worksheet.getRow(1);
      headerRow.getCell(1).value = 'Employee Name';
      worksheet.getColumn(1).width = 25;

      daysInThisMonth.forEach((day, idx) => {
        headerRow.getCell(idx + 2).value = format(day, 'd');
        worksheet.getColumn(idx + 2).width = 12;
      });
      headerRow.font = { bold: true };

      exportData.users.forEach((user: any, userIdx: number) => {
        const row = worksheet.getRow(2 + userIdx);
        row.getCell(1).value = user.name;

        daysInThisMonth.forEach((day, dayIdx) => {
          let status = '';
          const currentDay = new Date(day).setHours(0, 0, 0, 0);
          const now = new Date().setHours(0, 0, 0, 0);

          const isHoliday = exportData.holidays?.some((h: any) => isSameDay(new Date(h.date), day));
          const leave = exportData.leaves?.find((l: any) => {
            const from = new Date(l.fromDate).setHours(0, 0, 0, 0);
            const to = new Date(l.toDate).setHours(0, 0, 0, 0);
            return l.userId === user._id && currentDay >= from && currentDay <= to;
          });
          const att = exportData.attendances?.find((a: any) => a.userId === user._id && isSameDay(new Date(a.date), day));

          if (att) {
            if (att.status === 'present') status = 'Present';
            else if (att.status === 'half-day') status = 'Half Day';
            else if (att.status === 'late') status = 'Late';
            else if (att.status === 'absent') status = 'Absent';
          } else if (leave) {
            const type = leave.leaveType || 'Leave';
            if (type.toLowerCase().includes('sick')) status = 'SL';
            else if (type.toLowerCase().includes('casual')) status = 'CL';
            else status = type.split(' ').map((w: string) => w[0]).join('').toUpperCase();
          } else if (isHoliday) {
            status = 'Holiday';
          } else {
            if (day.getDay() === 0 || day.getDay() === 6) {
              status = 'WO';
            } else if (currentDay > now) {
              status = '';
            } else if (user.joiningDate && currentDay < new Date(user.joiningDate).setHours(0, 0, 0, 0)) {
              status = '-';
            } else {
              status = 'Absent';
            }
          }

          row.getCell(dayIdx + 2).value = status;
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Attendance_Calendar_${format(currentDate, 'MMM_yyyy')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-[140px] justify-center">
              <CalendarIcon className="w-4 h-4 text-primary" />
              <span className="font-bold text-card-foreground">{format(currentDate, 'MMMM yyyy')}</span>
            </div>
            <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center justify-center px-4 py-2 min-h-[44px] bg-secondary border border-border text-secondary-foreground rounded-xl hover:bg-secondary/80 transition-colors shadow-sm text-sm font-bold disabled:opacity-50 mr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Export Excel
            </button>
            <UserIcon className="w-4 h-4 text-muted-foreground" />
            <select
              className="bg-background border border-border text-foreground text-sm rounded-xl focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none block w-full sm:w-64 p-2.5 min-h-[44px]"
              value={selectedUser || ''}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="">Select Employee...</option>
              {employeesData?.users?.map((emp: any) => (
                <option key={emp._id} value={emp._id}>{emp.name} ({emp.employeeId})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[750px] lg:min-w-full">
            <div className="grid grid-cols-7 border-b border-border bg-muted/30">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  {day}
                </div>
              ))}
            </div>

            <div className="relative">
              {isLoading && (
                <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              )}
              {data?.error && (
                <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-destructive bg-destructive/10 p-4 rounded-xl border border-destructive/20 font-bold">{data.error}</div>
                </div>
              )}
              <div className="grid grid-cols-7 auto-rows-fr bg-border gap-[1px]">
                {daysInMonth.map((day) => {
                  const details = getDayDetails(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const today = isToday(day);

                  return (
                    <div
                      key={day.toString()}
                      onClick={() => handleDayClick(day, details)}
                      className={clsx(
                        "min-h-[110px] sm:min-h-[130px] bg-card p-1.5 sm:p-2 transition-colors relative group flex flex-col justify-between",
                        !isCurrentMonth && "bg-card/50 opacity-50",
                        today && "ring-1 ring-inset ring-primary/50 bg-primary/5",
                        isAdmin && selectedUser && "cursor-pointer hover:bg-accent"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={clsx(
                          "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                          today ? "bg-primary text-primary-foreground" : isCurrentMonth ? "text-card-foreground" : "text-muted-foreground/50",
                          (day.getDay() === 0 || day.getDay() === 6) && isCurrentMonth && !today && "text-destructive"
                        )}>
                          {format(day, 'd')}
                        </span>
                      </div>

                      {details && details.isHoliday && (
                        <div className="px-1.5 py-1 rounded-md border text-[11px] font-bold bg-primary/10 text-primary border-primary/20 truncate">
                          {details.label}
                        </div>
                      )}

                      {details && details.isWeeklyOff && (
                        <div className="px-1.5 py-1 rounded-md border text-[11px] font-semibold bg-muted/40 text-muted-foreground border-transparent truncate">
                          Weekly Off
                        </div>
                      )}

                      {details && details.isBeforeJoining && (
                        <div className="text-center text-xs text-muted-foreground">-</div>
                      )}

                      {details && details.firstHalf && details.secondHalf && (
                        <div className="space-y-1">
                          <div className={clsx("px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center justify-between", details.firstHalf.color)}>
                            <span className="opacity-70 text-[9px] mr-1 uppercase">1st</span>
                            <span className="truncate">{details.firstHalf.label}</span>
                          </div>

                          <div className={clsx("px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center justify-between", details.secondHalf.color)}>
                            <span className="opacity-70 text-[9px] mr-1 uppercase">2nd</span>
                            <span className="truncate">{details.secondHalf.label}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal supporting separate First Half & Second Half entry */}
      {isEditModalOpen && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-xl animate-in fade-in zoom-in-95 duration-200 my-8">
            <h3 className="text-lg font-bold text-card-foreground mb-4 border-b border-border pb-3 flex items-center justify-between">
              <span>Edit Attendance & Leaves</span>
              <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-bold">
                {format(selectedDate, 'MMM d, yyyy')}
              </span>
            </h3>

            <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
              {/* Quick Preset Action */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">Quick Action / Full Day Status</label>
                <select
                  className="w-full bg-background border border-border text-foreground text-sm font-bold rounded-xl p-2.5 min-h-[44px] focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
                  value={editData.status}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === 'present') {
                      setEditData({
                        ...editData,
                        status: 'present',
                        firstHalfStatus: 'present',
                        secondHalfStatus: 'present'
                      });
                    } else if (val === 'absent') {
                      setEditData({
                        ...editData,
                        status: 'absent',
                        firstHalfStatus: 'absent',
                        secondHalfStatus: 'absent'
                      });
                    } else if (val === 'none') {
                      setEditData({
                        ...editData,
                        status: 'none',
                        firstHalfStatus: 'absent',
                        firstHalfIn: '',
                        firstHalfOut: '',
                        secondHalfStatus: 'absent',
                        secondHalfIn: '',
                        secondHalfOut: ''
                      });
                    } else {
                      setEditData({ ...editData, status: val });
                    }
                  }}
                >
                  <option value="present">Present (Full Day Work)</option>
                  <option value="absent">Absent (Full Day)</option>
                  <option value="none">Clear Record</option>
                  <optgroup label="Apply Full Day Leave">
                    {LEAVE_TYPES.map(lt => (
                      <option key={lt} value={lt}>{lt}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* FIRST HALF EDIT SECTION */}
              <div className="p-4 border border-primary/30 rounded-xl bg-primary/5 space-y-3">
                <div className="font-bold text-sm text-primary flex items-center justify-between">
                  <span className="flex items-center"><Clock className="w-4 h-4 mr-1.5" /> First Half (Session 1)</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-card-foreground mb-1">Status / Leave</label>
                    <select
                      className="w-full bg-background border border-border text-foreground text-xs font-bold rounded-lg p-2 min-h-[38px] focus:ring-1 focus:ring-primary focus:outline-none"
                      value={editData.firstHalfStatus}
                      onChange={e => setEditData({ ...editData, firstHalfStatus: e.target.value })}
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="leave">Leave</option>
                    </select>
                  </div>

                  {editData.firstHalfStatus === 'leave' && (
                    <div>
                      <label className="block text-xs font-bold text-card-foreground mb-1">Leave Type</label>
                      <select
                        className="w-full bg-background border border-border text-foreground text-xs font-bold rounded-lg p-2 min-h-[38px] focus:ring-1 focus:ring-primary focus:outline-none"
                        value={editData.firstHalfLeaveType}
                        onChange={e => setEditData({ ...editData, firstHalfLeaveType: e.target.value })}
                      >
                        {LEAVE_TYPES.map(lt => (
                          <option key={lt} value={lt}>{lt}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {editData.firstHalfStatus !== 'leave' && editData.firstHalfStatus !== 'absent' && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1">Check In Time</label>
                      <input
                        type="time"
                        className="w-full bg-background border border-border text-foreground text-xs font-bold rounded-lg p-2 min-h-[38px] focus:ring-1 focus:ring-primary focus:outline-none"
                        value={editData.firstHalfIn}
                        onChange={e => setEditData({ ...editData, firstHalfIn: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1">Check Out Time</label>
                      <input
                        type="time"
                        className="w-full bg-background border border-border text-foreground text-xs font-bold rounded-lg p-2 min-h-[38px] focus:ring-1 focus:ring-primary focus:outline-none"
                        value={editData.firstHalfOut}
                        onChange={e => setEditData({ ...editData, firstHalfOut: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECOND HALF EDIT SECTION */}
              <div className="p-4 border border-border rounded-xl bg-muted/20 space-y-3">
                <div className="font-bold text-sm text-card-foreground flex items-center justify-between">
                  <span className="flex items-center"><Clock className="w-4 h-4 mr-1.5 text-muted-foreground" /> Second Half (Session 2)</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-card-foreground mb-1">Status / Leave</label>
                    <select
                      className="w-full bg-background border border-border text-foreground text-xs font-bold rounded-lg p-2 min-h-[38px] focus:ring-1 focus:ring-primary focus:outline-none"
                      value={editData.secondHalfStatus}
                      onChange={e => setEditData({ ...editData, secondHalfStatus: e.target.value })}
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="leave">Leave</option>
                    </select>
                  </div>

                  {editData.secondHalfStatus === 'leave' && (
                    <div>
                      <label className="block text-xs font-bold text-card-foreground mb-1">Leave Type</label>
                      <select
                        className="w-full bg-background border border-border text-foreground text-xs font-bold rounded-lg p-2 min-h-[38px] focus:ring-1 focus:ring-primary focus:outline-none"
                        value={editData.secondHalfLeaveType}
                        onChange={e => setEditData({ ...editData, secondHalfLeaveType: e.target.value })}
                      >
                        {LEAVE_TYPES.map(lt => (
                          <option key={lt} value={lt}>{lt}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {editData.secondHalfStatus !== 'leave' && editData.secondHalfStatus !== 'absent' && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1">Check In Time</label>
                      <input
                        type="time"
                        className="w-full bg-background border border-border text-foreground text-xs font-bold rounded-lg p-2 min-h-[38px] focus:ring-1 focus:ring-primary focus:outline-none"
                        value={editData.secondHalfIn}
                        onChange={e => setEditData({ ...editData, secondHalfIn: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1">Check Out Time</label>
                      <input
                        type="time"
                        className="w-full bg-background border border-border text-foreground text-xs font-bold rounded-lg p-2 min-h-[38px] focus:ring-1 focus:ring-primary focus:outline-none"
                        value={editData.secondHalfOut}
                        onChange={e => setEditData({ ...editData, secondHalfOut: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors p-2 rounded-xl hover:bg-accent min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-6 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
