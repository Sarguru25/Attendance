'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { format } from 'date-fns';
import { Search, CheckCircle, XCircle, Clock, User as UserIcon, Calendar } from 'lucide-react';
import { api } from '@/services/api';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function LeavesClient() {
  const { data, error, isLoading, mutate } = useSWR('/api/admin/leaves', fetcher);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const res = await api(`/api/admin/leaves/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update');
      mutate();
    } catch (err) {
      alert('Error updating leave status');
    }
  };

  const leaves = data?.leaves || [];
  
  const filteredLeaves = leaves.filter((leave: any) => {
    const matchesSearch = leave.userId?.name?.toLowerCase().includes(search.toLowerCase()) || 
                          leave.userId?.employeeId?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter ? leave.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="px-2 py-1 text-xs font-bold bg-success/10 text-success border border-success/20 rounded-full flex items-center w-fit"><CheckCircle className="w-3 h-3 mr-1" /> Approved</span>;
      case 'rejected': return <span className="px-2 py-1 text-xs font-bold bg-destructive/10 text-destructive border border-destructive/20 rounded-full flex items-center w-fit"><XCircle className="w-3 h-3 mr-1" /> Rejected</span>;
      default: return <span className="px-2 py-1 text-xs font-bold bg-warning/10 text-warning border border-warning/20 rounded-full flex items-center w-fit"><Clock className="w-3 h-3 mr-1" /> Pending</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Leave Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage employee leave applications.</p>
        </div>
        <Link 
          href="/admin/employees?tab=leaves"
          className="w-full sm:w-auto flex justify-center items-center px-4 py-2 min-h-[44px] bg-secondary border border-border text-secondary-foreground rounded-xl hover:bg-secondary/80 transition-colors shadow-sm font-bold text-sm"
        >
          Manage Leave Balances
        </Link>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-border rounded-xl min-h-[44px] leading-5 bg-background text-foreground font-bold placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            placeholder="Search employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <select 
          className="w-full md:w-48 bg-background border border-border rounded-xl px-3 py-2 min-h-[44px] text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Leave Type</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center font-bold text-muted-foreground">Loading...</td></tr>
              ) : filteredLeaves.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center font-bold text-muted-foreground">No leave requests found.</td></tr>
              ) : (
                filteredLeaves.map((leave: any) => {
                  const days = Math.round((new Date(leave.toDate).getTime() - new Date(leave.fromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  return (
                    <tr key={leave._id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-muted rounded-full flex items-center justify-center overflow-hidden border border-border">
                            {leave.userId?.profileImage ? (
                              <img src={leave.userId.profileImage} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <UserIcon className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-bold text-card-foreground">{leave.userId?.name || 'Unknown User'}</div>
                            <div className="text-xs text-muted-foreground font-bold">{leave.userId?.employeeId} • {leave.userId?.department}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-card-foreground">
                        {leave.leaveType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-card-foreground">{format(new Date(leave.fromDate), 'MMM dd')} {leave.duration === 'multiple_days' ? `- ${format(new Date(leave.toDate), 'MMM dd')}` : ''}</div>
                        <div className="text-xs font-bold text-muted-foreground">{leave.numberOfDays || days} Day{(leave.numberOfDays || days) !== 1 && 's'} {leave.duration === 'half_day' && `(${leave.halfDaySession === 'first_half' ? 'First Half' : 'Second Half'})`}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-card-foreground max-w-xs truncate" title={leave.reason}>{leave.reason}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(leave.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold">
                        {leave.status === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => handleStatusUpdate(leave._id, 'approved')}
                              className="px-4 py-2 min-h-[44px] bg-success text-success-foreground hover:bg-success/90 text-xs font-bold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => handleStatusUpdate(leave._id, 'rejected')}
                              className="px-4 py-2 min-h-[44px] bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-bold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                            >
                              Reject
                            </button>
                          </div>
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
    </div>
  );
}
