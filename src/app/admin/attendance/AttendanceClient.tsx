'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { Search, Download, Filter, User, Edit, X, Loader2 } from 'lucide-react';
import * as ExcelJS from 'exceljs';
import { api } from '@/services/api';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AttendanceClient() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [limit, setLimit] = useState('100');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, dateFilter, statusFilter, shiftFilter, limit]);

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit,
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(dateFilter && { date: dateFilter }),
    ...(statusFilter && { status: statusFilter }),
    ...(shiftFilter && { shift: shiftFilter }),
  }).toString();

  const { data, error, isLoading, mutate } = useSWR(`/api/admin/attendance?${queryParams}`, fetcher, {
    refreshInterval: 10000, // Poll for live updates
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    loginTime: '',
    logoutTime: '',
    status: 'present',
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const openEditModal = (record: any) => {
    setEditingRecord(record);
    
    // Format times to HH:mm for time inputs
    const formatTimeForInput = (dateString?: string) => {
      if (!dateString) return '';
      const d = new Date(dateString);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    setEditFormData({
      loginTime: formatTimeForInput(record.loginTime),
      logoutTime: formatTimeForInput(record.logoutTime),
      status: record.status,
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    
    setIsUpdating(true);
    try {
      const response = await api(`/api/admin/attendance/${editingRecord._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to update attendance');
      } else {
        mutate();
        setIsEditModalOpen(false);
      }
    } catch (error) {
      alert('An error occurred');
    } finally {
      setIsUpdating(false);
    }
  };
  
  const { data: shiftData } = useSWR('/api/shifts', fetcher);

  const handleExport = async () => {
    if (!data?.attendances?.length) return;
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance');
    
    worksheet.columns = [
      { header: 'Employee ID', key: 'empId', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Shift', key: 'shift', width: 15 },
      { header: 'Check In', key: 'in', width: 15 },
      { header: 'Check Out', key: 'out', width: 15 },
      { header: 'Total Hours', key: 'hours', width: 15 },
      { header: 'Late (Mins)', key: 'late', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    data.attendances.forEach((a: any) => {
      worksheet.addRow({
        empId: a.userId?.employeeId,
        name: a.userId?.name,
        date: format(new Date(a.date), 'yyyy-MM-dd'),
        shift: a.userId?.shiftId?.shiftName || 'N/A',
        in: a.loginTime ? format(new Date(a.loginTime), 'hh:mm a') : '-',
        out: a.logoutTime ? format(new Date(a.logoutTime), 'hh:mm a') : '-',
        hours: a.totalHours ? `${Math.floor(a.totalHours)}.${Math.round((a.totalHours % 1) * 60).toString().padStart(2, '0')}` : '-',
        late: a.lateMinutes || 0,
        status: a.status.toUpperCase(),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      present: 'bg-success/10 text-success border-success/20',
      absent: 'bg-destructive/10 text-destructive border-destructive/20',
      'half-day': 'bg-primary/10 text-primary border-primary/20',
      late: 'bg-warning/10 text-warning border-warning/20',
      'Weekly Off': 'bg-muted text-muted-foreground border-border',
      'Work From Home': 'bg-primary/10 text-primary border-primary/20',
      'On Duty': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      'Restricted Holiday': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      'Leave': 'bg-pink-500/10 text-pink-400 border-pink-500/20',
      'Holiday': 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    };
    return (
      <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${styles[status] || 'bg-muted text-muted-foreground border-border'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Attendance Log</h1>
        <button 
          onClick={handleExport}
          className="w-full sm:w-auto flex justify-center items-center px-4 py-2 bg-primary text-primary-foreground min-h-[44px] rounded-xl hover:bg-primary/90 transition-colors shadow-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Download className="h-4 w-4 mr-2" />
          Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-border bg-background text-foreground font-bold placeholder-muted-foreground min-h-[44px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm rounded-xl"
            placeholder="Search name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <input 
          type="date"
          className="w-full md:w-48 bg-background border border-border rounded-xl px-3 py-2 text-sm font-bold min-h-[44px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />

        <select 
          className="w-full md:w-48 bg-background border border-border rounded-xl px-3 py-2 text-sm font-bold min-h-[44px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="present">Present</option>
          <option value="late">Late</option>
          <option value="half-day">Half-Day</option>
          <option value="absent">Absent</option>
          <option value="Weekly Off">Weekly Off</option>
          <option value="Work From Home">Work From Home</option>
          <option value="On Duty">On Duty</option>
          <option value="Leave">Leave</option>
          <option value="Holiday">Holiday</option>
          <option value="Restricted Holiday">Restricted Holiday</option>
        </select>

        <select 
          className="w-full md:w-48 bg-background border border-border rounded-xl px-3 py-2 text-sm font-bold min-h-[44px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          value={shiftFilter}
          onChange={(e) => setShiftFilter(e.target.value)}
        >
          <option value="">All Shifts</option>
          {shiftData?.shifts?.map((s: any) => (
            <option key={s._id} value={s._id}>{s.shiftName}</option>
          ))}
        </select>

        <select 
          className="w-full md:w-32 bg-background border border-border rounded-xl px-3 py-2 text-sm font-bold min-h-[44px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        >
          <option value="10">10 / page</option>
          <option value="25">25 / page</option>
          <option value="50">50 / page</option>
          <option value="100">100 / page</option>
          <option value="500">500 / page</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/30 sticky top-0">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Employee</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Shift</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">In/Out Time</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Hours</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Late</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 bg-muted rounded w-3/4"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 bg-muted rounded w-1/2"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 bg-muted rounded w-1/2"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 bg-muted rounded w-1/2"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 bg-muted rounded w-1/4"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 bg-muted rounded w-1/4"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 bg-muted rounded w-1/2"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"></td>
                  </tr>
                ))
              ) : data?.attendances?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-muted-foreground font-bold">No attendance records found.</td>
                </tr>
              ) : (
                data?.attendances?.map((record: any) => (
                  <tr key={record._id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-muted rounded-full flex items-center justify-center overflow-hidden">
                          {record.userId?.profileImage ? (
                            <img src={record.userId.profileImage} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-card-foreground">{record.userId?.name}</div>
                          <div className="text-xs font-bold text-muted-foreground">{record.userId?.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-muted text-muted-foreground font-bold text-xs rounded block w-max mb-1">
                        {record.userId?.shiftId?.shiftName || 'N/A'}
                      </span>
                      <div className="text-[10px] font-bold text-muted-foreground">
                        {record.userId?.shiftId?.workingDays?.map((d: string) => d.slice(0, 3)).join('-') || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-card-foreground">
                      {format(new Date(record.date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-card-foreground">In: {record.loginTime ? format(new Date(record.loginTime), 'hh:mm a') : '--:--'}</div>
                      <div className="text-sm font-bold text-muted-foreground">Out: {record.logoutTime ? format(new Date(record.logoutTime), 'hh:mm a') : '--:--'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-card-foreground">
                      {record.totalHours ? `${Math.floor(record.totalHours)}.${Math.round((record.totalHours % 1) * 60).toString().padStart(2, '0')}h` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-card-foreground">
                      {record.lateMinutes > 0 ? <span className="text-warning">{record.lateMinutes}m</span> : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(record.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold">
                      <button 
                        onClick={() => openEditModal(record)}
                        className="text-muted-foreground hover:text-foreground font-bold min-h-[44px] px-2 rounded-xl transition-colors"
                        title="Edit Attendance"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="bg-muted/30 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border">
            <div className="text-sm font-bold text-muted-foreground text-center sm:text-left">
              Showing <span className="font-bold text-foreground">{(page - 1) * parseInt(limit) + 1}</span> to <span className="font-bold text-foreground">{Math.min(page * parseInt(limit), data.pagination.total)}</span> of <span className="font-bold text-foreground">{data.pagination.total}</span> results
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-background border border-border text-foreground font-bold rounded-xl min-h-[44px] text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button 
                onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
                className="px-3 py-1 bg-background border border-border text-foreground font-bold rounded-xl min-h-[44px] text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-black/80 backdrop-blur-sm z-0" onClick={() => setIsEditModalOpen(false)} />

            <div className="relative z-10 inline-block w-full max-w-md px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-card border border-border rounded-2xl shadow-sm sm:my-8 sm:align-middle sm:p-6">
              <div className="flex justify-between items-center mb-5 border-b border-border pb-4">
                <h3 className="text-lg font-bold tracking-tight text-card-foreground">Edit Attendance</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="text-muted-foreground hover:text-foreground font-bold min-h-[44px] px-2 rounded-xl">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="bg-muted/30 p-3 rounded-xl mb-4 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground font-bold">Employee:</span>
                    <span className="text-card-foreground font-bold">{editingRecord?.userId?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-bold">Date:</span>
                    <span className="text-card-foreground font-bold">{editingRecord?.date ? format(new Date(editingRecord.date), 'MMM dd, yyyy') : ''}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-card-foreground mb-1">Status</label>
                  <select
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground font-bold min-h-[44px] focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                  >
                    <option value="none">None (Clear Record)</option>
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="half-day">Half-Day</option>
                    <option value="absent">Absent</option>
                    <option value="Weekly Off">Weekly Off</option>
                    <option value="Work From Home">Work From Home</option>
                    <option value="On Duty">On Duty</option>
                    <option value="Leave">Leave</option>
                    <option value="Holiday">Holiday</option>
                    <option value="Restricted Holiday">Restricted Holiday</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-card-foreground mb-1">Check In Time</label>
                    <input
                      type="time"
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground font-bold min-h-[44px] focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
                      value={editFormData.loginTime}
                      onChange={(e) => setEditFormData({...editFormData, loginTime: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-card-foreground mb-1">Check Out Time</label>
                    <input
                      type="time"
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground font-bold min-h-[44px] focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
                      value={editFormData.logoutTime}
                      onChange={(e) => setEditFormData({...editFormData, logoutTime: e.target.value})}
                    />
                  </div>
                </div>

                <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse border-t border-border pt-4">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 min-h-[44px]"
                  >
                    {isUpdating ? <Loader2 className="animate-spin h-5 w-5" /> : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-xl border border-border shadow-sm px-4 py-2 bg-muted/30 text-base font-bold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none sm:mt-0 sm:w-auto sm:text-sm min-h-[44px]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
