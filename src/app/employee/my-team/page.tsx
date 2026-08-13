'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Search, 
  Calendar as CalendarIcon,
  ChevronRight,
  Briefcase,
  User as UserIcon,
  MapPin,
  Building,
  Timer
} from 'lucide-react';
import Image from 'next/image';

interface TeamMember {
  _id: string;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  profileImage?: string;
  shift?: any;
  company?: { _id: string, name: string };
  status: string;
  todayAttendance?: any;
}

interface TeamSummary {
  total: number;
  present: number;
  onLeave: number;
  absent: number;
  late: number;
}

export default function MyTeamPage() {
  const { data: session } = useSession();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [designationFilter, setDesignationFilter] = useState('All');

  // Employee Drawer State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [employeeDetails, setEmployeeDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');

  const fetchTeam = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/employee/my-team');
      if (!res.ok) throw new Error('Failed to fetch team data');
      const data = await res.json();
      setTeam(data.team || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchEmployeeDetails = async (id: string) => {
    try {
      setLoadingDetails(true);
      const res = await fetch(`/api/employee/my-team/${id}`);
      if (!res.ok) throw new Error('Failed to fetch employee details');
      const data = await res.json();
      setEmployeeDetails(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchEmployeeDetails(selectedEmployeeId);
      setActiveTab('Overview'); // Reset tab when a new employee is selected
    } else {
      setEmployeeDetails(null);
    }
  }, [selectedEmployeeId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-red-600 mb-2">Error loading team</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <button onClick={fetchTeam} className="bg-primary text-white px-4 py-2 rounded-md">Retry</button>
      </div>
    );
  }

  if (team.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-card rounded-lg border border-border shadow-sm">
        <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No Team Members Found</h3>
        <p className="text-muted-foreground">You currently don't have any employees reporting to you.</p>
      </div>
    );
  }

  // Filter lists
  const departments = ['All', ...Array.from(new Set(team.map(m => m.department).filter(Boolean)))];
  const designations = ['All', ...Array.from(new Set(team.map(m => m.designation).filter(Boolean)))];
  const statuses = ['All', 'present', 'absent', 'late', 'Leave', 'half-day'];

  // Filtered Team
  const filteredTeam = team.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          member.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          member.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    let memberStatus = member.status || 'absent';
    
    const matchesStatus = statusFilter === 'All' || memberStatus === statusFilter || (statusFilter === 'present' && memberStatus === 'late');
    const matchesDept = departmentFilter === 'All' || member.department === departmentFilter;
    const matchesDesig = designationFilter === 'All' || member.designation === designationFilter;

    return matchesSearch && matchesStatus && matchesDept && matchesDesig;
  });

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || 'absent';
    switch (s) {
      case 'present': 
        return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-success/10 text-success border border-success/20 rounded-md flex items-center w-fit"><CheckCircle2 className="w-3 h-3 mr-1.5" /> Present</span>;
      case 'late': 
        return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-warning/10 text-warning border border-warning/20 rounded-md flex items-center w-fit"><Clock className="w-3 h-3 mr-1.5" /> Late</span>;
      case 'leave':
      case 'half-day': 
        return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 rounded-md flex items-center w-fit"><CalendarIcon className="w-3 h-3 mr-1.5" /> {s === 'half-day' ? 'Half Day' : 'Leave'}</span>;
      case 'absent':
      default: 
        return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-destructive/10 text-destructive border border-destructive/20 rounded-md flex items-center w-fit"><XCircle className="w-3 h-3 mr-1.5" /> {s === 'absent' ? 'Absent' : s}</span>;
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Team</h1>
        <p className="text-muted-foreground">Manage and monitor your team members</p>
      </div>

      {/* Summary Cards */}
      {/* {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-card p-4 rounded-lg shadow-sm border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Total Team</span>
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold">{summary.total}</div>
          </div>
          <div className="bg-white dark:bg-card p-4 rounded-lg shadow-sm border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Present Today</span>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold">{summary.present}</div>
          </div>
          <div className="bg-white dark:bg-card p-4 rounded-lg shadow-sm border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Late Today</span>
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="text-2xl font-bold">{summary.late}</div>
          </div>
          <div className="bg-white dark:bg-card p-4 rounded-lg shadow-sm border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">On Leave</span>
              <CalendarIcon className="h-5 w-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold">{summary.onLeave}</div>
          </div>
          <div className="bg-white dark:bg-card p-4 rounded-lg shadow-sm border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Absent Today</span>
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="text-2xl font-bold">{summary.absent}</div>
          </div>
        </div>
      )} */}

      {/* Filters & Search */}
      <div className="bg-white dark:bg-card p-4 rounded-lg shadow-sm border border-border space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search team members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-transparent border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-transparent border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
            >
              <option value="All">All Status</option>
              {statuses.filter(s => s !== 'All').map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <select 
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 bg-transparent border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
            >
              <option value="All">All Depts</option>
              {departments.filter(d => d !== 'All').map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select 
              value={designationFilter}
              onChange={(e) => setDesignationFilter(e.target.value)}
              className="px-3 py-2 bg-transparent border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
            >
              <option value="All">All Designations</option>
              {designations.filter(d => d !== 'All').map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Team List - Desktop Table / Mobile Cards */}
      <div className="bg-white dark:bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        {/* Mobile View */}
        <div className="md:hidden divide-y divide-border">
          {filteredTeam.map(member => (
            <div 
              key={member._id} 
              className="p-4 flex flex-col space-y-3 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setSelectedEmployeeId(member._id)}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium overflow-hidden">
                    {member.profileImage ? (
                      <img src={member.profileImage} alt={member.name} className="h-full w-full object-cover" />
                    ) : (
                      member.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">{member.name}</h3>
                    <p className="text-xs text-muted-foreground">{member.designation}</p>
                    <p className="text-[10px] text-muted-foreground/70">{member.company?.name || 'Unknown Company'}</p>
                  </div>
                </div>
                {getStatusBadge(member.status)}
              </div>
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>Check In: {formatTime(member.todayAttendance?.loginTime)}</span>
                <span className="flex items-center text-primary">View <ChevronRight className="h-3 w-3 ml-1"/></span>
              </div>
            </div>
          ))}
          {filteredTeam.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No team members match your filters.</div>
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted-foreground bg-muted/50">
                <th className="px-6 py-3 font-medium">Employee</th>
                <th className="px-6 py-3 font-medium">ID</th>
                {/* <th className="px-6 py-3 font-medium">Company</th> */}
                <th className="px-6 py-3 font-medium">Department</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Check In</th>
                <th className="px-6 py-3 font-medium">Check Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTeam.map((member) => (
                <tr 
                  key={member._id} 
                  className="hover:bg-accent/50 cursor-pointer transition-colors group"
                  onClick={() => setSelectedEmployeeId(member._id)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium overflow-hidden text-xs">
                        {member.profileImage ? (
                          <img src={member.profileImage} alt={member.name} className="h-full w-full object-cover" />
                        ) : (
                          member.name.charAt(0)
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-sm group-hover:text-primary transition-colors">{member.name}</div>
                        <div className="text-xs text-muted-foreground">{member.designation}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{member.employeeId}</td>
                  {/* <td className="px-6 py-4 text-sm text-muted-foreground">{member.company?.name || '-'}</td> */}
                  <td className="px-6 py-4 text-sm text-muted-foreground">{member.department}</td>
                  <td className="px-6 py-4">{getStatusBadge(member.status)}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{formatTime(member.todayAttendance?.loginTime)}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{formatTime(member.todayAttendance?.logoutTime)}</td>
                </tr>
              ))}
              {filteredTeam.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    No team members match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Details Modal / Drawer overlay */}
      {selectedEmployeeId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setSelectedEmployeeId(null)}>
          <div 
            className="w-full max-w-2xl bg-background h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">Employee Details</h2>
              <button onClick={() => setSelectedEmployeeId(null)} className="p-2 hover:bg-accent rounded-full text-muted-foreground hover:text-foreground">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loadingDetails || !employeeDetails ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  {/* Header Profile */}
                  <div className="flex items-start space-x-4">
                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium overflow-hidden text-2xl shrink-0">
                      {employeeDetails.employee.profileImage ? (
                        <img src={employeeDetails.employee.profileImage} alt={employeeDetails.employee.name} className="h-full w-full object-cover" />
                      ) : (
                        employeeDetails.employee.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{employeeDetails.employee.name}</h3>
                      <p className="text-muted-foreground text-sm">{employeeDetails.employee.employeeId}</p>
                      <p className="text-sm font-medium mt-1">{employeeDetails.employee.designation}</p>
                      <p className="text-xs text-muted-foreground">{employeeDetails.employee.department} Department</p>
                      <p className="text-xs font-bold text-primary mt-1">{employeeDetails.employee.companyId?.name || employeeDetails.employee.company?.name || 'Unknown Company'}</p>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex space-x-1 border-b border-border overflow-x-auto pb-[1px]">
                    {['Overview', 'Attendance', 'Leaves', 'Permissions', 'Extra Hours'].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                          activeTab === tab 
                            ? 'border-primary text-primary' 
                            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  <div className="mt-4">
                    {/* OVERVIEW TAB */}
                    {activeTab === 'Overview' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <div className="flex items-center text-sm text-muted-foreground">
                              <UserIcon className="h-4 w-4 mr-2" />
                              <span className="w-24">Email:</span>
                              <span className="text-foreground font-medium">{employeeDetails.employee.email}</span>
                            </div>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Briefcase className="h-4 w-4 mr-2" />
                              <span className="w-24">Role:</span>
                              <span className="text-foreground font-medium capitalize">{employeeDetails.employee.role}</span>
                            </div>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Building className="h-4 w-4 mr-2" />
                              <span className="w-24">Reporting To:</span>
                              <span className="text-foreground font-medium">{employeeDetails.employee.reportsTo?.name || '-'}</span>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center text-sm text-muted-foreground">
                              <CalendarIcon className="h-4 w-4 mr-2" />
                              <span className="w-24">Joined:</span>
                              <span className="text-foreground font-medium">
                                {employeeDetails.employee.joiningDate ? new Date(employeeDetails.employee.joiningDate).toLocaleDateString() : '-'}
                              </span>
                            </div>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Clock className="h-4 w-4 mr-2" />
                              <span className="w-24">Shift:</span>
                              <span className="text-foreground font-medium">{employeeDetails.employee.shiftId?.shiftName || 'Standard'}</span>
                            </div>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4 mr-2" />
                              <span className="w-24">Location:</span>
                              <span className="text-foreground font-medium">Office</span>
                            </div>
                          </div>
                        </div>

                        {/* Attendance Insight Summary */}
                        <div className="bg-muted/30 p-4 rounded-lg border border-border">
                          <h4 className="font-medium text-sm mb-3">Current Month Attendance</h4>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-background rounded p-2 border border-border">
                              <div className="text-xs text-muted-foreground">Present</div>
                              <div className="font-bold text-green-600">{employeeDetails.attendanceSummary.present}</div>
                            </div>
                            <div className="bg-background rounded p-2 border border-border">
                              <div className="text-xs text-muted-foreground">Late</div>
                              <div className="font-bold text-yellow-600">{employeeDetails.attendanceSummary.late}</div>
                            </div>
                            <div className="bg-background rounded p-2 border border-border">
                              <div className="text-xs text-muted-foreground">Absent</div>
                              <div className="font-bold text-red-600">{employeeDetails.attendanceSummary.absent}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ATTENDANCE TAB */}
                    {activeTab === 'Attendance' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Recent Attendance History</h4>
                        </div>
                        <div className="overflow-x-auto border border-border rounded-lg">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50 border-b border-border">
                              <tr>
                                <th className="px-4 py-2 font-medium">Date</th>
                                <th className="px-4 py-2 font-medium">Status</th>
                                <th className="px-4 py-2 font-medium">Check In</th>
                                <th className="px-4 py-2 font-medium">Check Out</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {employeeDetails.attendances.slice(0, 15).map((record: any) => (
                                <tr key={record._id}>
                                  <td className="px-4 py-2">{new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                                  <td className="px-4 py-2">{getStatusBadge(record.status)}</td>
                                  <td className="px-4 py-2">{formatTime(record.loginTime)}</td>
                                  <td className="px-4 py-2">{formatTime(record.logoutTime)}</td>
                                </tr>
                              ))}
                              {employeeDetails.attendances.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No attendance records found for this month.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* LEAVES TAB */}
                    {activeTab === 'Leaves' && (
                      <div className="space-y-6">
                        {employeeDetails.leaveBalance && (
                          <div>
                            <h4 className="text-sm font-medium mb-3">Leave Balance</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {Object.entries(employeeDetails.leaveBalance).map(([key, value]: [string, any]) => {
                                if (typeof value === 'object' && value !== null && 'available' in value) {
                                  return (
                                    <div key={key} className="bg-muted/30 p-3 rounded-lg border border-border">
                                      <div className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                                      <div className="font-bold">{value.available} <span className="text-xs font-normal text-muted-foreground">/ {value.total}</span></div>
                                    </div>
                                  );
                                }
                                return null;
                              })}
                            </div>
                          </div>
                        )}
                        
                        <div>
                          <h4 className="text-sm font-medium mb-3">Recent Leaves</h4>
                          <div className="space-y-2">
                            {employeeDetails.recentLeaves.length > 0 ? employeeDetails.recentLeaves.map((leave: any) => (
                              <div key={leave._id} className="p-3 border border-border rounded-lg flex justify-between items-center text-sm">
                                <div>
                                  <div className="font-medium capitalize">{leave.leaveType.replace('_', ' ')}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(leave.fromDate).toLocaleDateString()} - {new Date(leave.toDate).toLocaleDateString()} 
                                    ({leave.numberOfDays} Days)
                                  </div>
                                </div>
                                <div>
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    leave.status === 'approved' ? 'bg-green-100 text-green-800' :
                                    leave.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {leave.status}
                                  </span>
                                </div>
                              </div>
                            )) : (
                              <div className="p-4 border border-dashed border-border rounded-lg text-center text-sm text-muted-foreground">
                                No recent leaves.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PERMISSIONS TAB */}
                    {activeTab === 'Permissions' && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium">Recent Permissions</h4>
                        <div className="space-y-2">
                          {employeeDetails.recentPermissions?.length > 0 ? employeeDetails.recentPermissions.map((perm: any) => (
                            <div key={perm._id} className="p-3 border border-border rounded-lg text-sm">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-medium">{new Date(perm.date).toLocaleDateString()}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {perm.startTime} - {perm.endTime} ({perm.durationMinutes} mins)
                                  </div>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs ${
                                  perm.status === 'approved' ? 'bg-green-100 text-green-800' :
                                  perm.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {perm.status}
                                </span>
                              </div>
                              <div className="text-xs bg-muted/50 p-2 rounded mt-2 flex justify-between items-center">
                                <span><span className="font-medium">Reason: </span> {perm.reason}</span>
                                <span><span className="font-medium">Compensation: </span> {perm.isCompensated ? 'Fully Compensated' : (perm.compensationRequired ? 'Required' : 'None')}</span>
                              </div>
                            </div>
                          )) : (
                            <div className="p-4 border border-dashed border-border rounded-lg text-center text-sm text-muted-foreground">
                              No recent permissions.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* EXTRA HOURS TAB */}
                    {activeTab === 'Extra Hours' && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium">Recent Extra Working Hours</h4>
                        <div className="overflow-x-auto border border-border rounded-lg">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50 border-b border-border">
                              <tr>
                                <th className="px-4 py-2 font-medium">Date</th>
                                <th className="px-4 py-2 font-medium">Shift Start</th>
                                <th className="px-4 py-2 font-medium">Extra Before</th>
                                <th className="px-4 py-2 font-medium">Extra After</th>
                                <th className="px-4 py-2 font-medium">Total Extra</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {employeeDetails.attendances.filter((a: any) => a.totalExtraMinutes > 0).slice(0, 15).map((record: any) => (
                                <tr key={record._id}>
                                  <td className="px-4 py-2">{new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                                  <td className="px-4 py-2">{record.sessions?.[0]?.checkIn ? formatTime(record.sessions[0].checkIn) : '-'}</td>
                                  <td className="px-4 py-2">{record.extraBeforeShiftMinutes || 0} mins</td>
                                  <td className="px-4 py-2">{record.extraAfterShiftMinutes || 0} mins</td>
                                  <td className="px-4 py-2 font-medium text-green-600">{record.totalExtraMinutes} mins</td>
                                </tr>
                              ))}
                              {employeeDetails.attendances.filter((a: any) => a.totalExtraMinutes > 0).length === 0 && (
                                <tr>
                                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No extra hours recorded this month.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
