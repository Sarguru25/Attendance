'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { format } from 'date-fns';
import { Plus, X, CheckCircle, XCircle, Clock, Loader2, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function EmployeeLeavesClient() {
  const { data, error, isLoading, mutate } = useSWR('/api/employee/leaves', fetcher);
  const searchParams = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams.get('apply') === 'true') {
      setIsModalOpen(true);
    }
  }, [searchParams]);
  
  const [formData, setFormData] = useState({
    leaveType: '',
    fromDate: '',
    toDate: '',
    duration: 'full_day',
    halfDaySession: '',
    reason: '',
    attachments: [] as string[]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const res = await api('/api/leaves/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to apply');
      }
      
      mutate();
      setIsModalOpen(false);
      setFormData({ leaveType: '', fromDate: '', toDate: '', duration: 'full_day', halfDaySession: '', reason: '', attachments: [] });
      toast.success('Leave applied successfully');
    } catch (err: any) {
      toast.error(err.message || 'Error applying for leave');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    Promise.all(files.map(file => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    })).then(base64Files => {
      setFormData(prev => ({ ...prev, attachments: [...prev.attachments, ...base64Files] }));
    });
  };

  const leaves = data?.leaves || [];
  const balanceData = data?.balance;
  
  // Calculate total taken days across all paid leave types
  const takenDays = balanceData ? (balanceData.casualLeave.taken + balanceData.sickLeave.taken + balanceData.restrictedLeave.taken) : 0;
  
  // Calculate total available balance across all paid leave types
  const availableBalance = balanceData ? (
    balanceData.casualLeave.available + 
    balanceData.sickLeave.available + 
    balanceData.restrictedLeave.available + 
    balanceData.compensatoryOff.available
  ) : 0;
  
  const totalAllowance = balanceData ? (balanceData.casualLeave.total + balanceData.sickLeave.total + balanceData.restrictedLeave.total) : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="px-2 py-1 text-xs font-medium bg-success/10 text-success border border-success/20 rounded-full flex items-center w-fit"><CheckCircle className="w-3 h-3 mr-1" /> Approved</span>;
      case 'rejected': return <span className="px-2 py-1 text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 rounded-full flex items-center w-fit"><XCircle className="w-3 h-3 mr-1" /> Rejected</span>;
      default: return <span className="px-2 py-1 text-xs font-medium bg-warning/10 text-warning border border-warning/20 rounded-full flex items-center w-fit"><Clock className="w-3 h-3 mr-1" /> Pending</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Leave Management</h1>
          <p className="text-sm text-muted-foreground mt-1">View your leave balances and history.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto flex justify-center items-center px-4 py-2 min-h-[44px] bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors shadow-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Plus className="h-4 w-4 mr-2" />
          Apply Leave
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Summary Cards */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-primary/50 transition-colors group">
          <div className="text-sm text-muted-foreground font-medium mb-2">Casual Leave</div>
          <div className="flex justify-between items-baseline">
            <div className="text-2xl font-bold text-card-foreground group-hover:text-primary transition-colors">{balanceData?.casualLeave.available ?? '-'}</div>
            <div className="text-xs text-muted-foreground">Taken: {balanceData?.casualLeave.taken ?? '-'}</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-primary/50 transition-colors group">
          <div className="text-sm text-muted-foreground font-medium mb-2">Sick Leave</div>
          <div className="flex justify-between items-baseline">
            <div className="text-2xl font-bold text-card-foreground group-hover:text-primary transition-colors">{balanceData?.sickLeave.available ?? '-'}</div>
            <div className="text-xs text-muted-foreground">Taken: {balanceData?.sickLeave.taken ?? '-'}</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-primary/50 transition-colors group">
          <div className="text-sm text-muted-foreground font-medium mb-2">Restricted Holiday</div>
          <div className="flex justify-between items-baseline">
            <div className="text-2xl font-bold text-card-foreground group-hover:text-primary transition-colors">{balanceData?.restrictedLeave.available ?? '-'}</div>
            <div className="text-xs text-muted-foreground">Taken: {balanceData?.restrictedLeave.taken ?? '-'}</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-primary/50 transition-colors group">
          <div className="text-sm text-muted-foreground font-medium mb-2">Compensatory Off</div>
          <div className="flex justify-between items-baseline">
            <div className="text-2xl font-bold text-card-foreground group-hover:text-primary transition-colors">{balanceData?.compensatoryOff.available ?? '-'}</div>
            <div className="text-xs text-muted-foreground">Taken: {balanceData?.compensatoryOff.taken ?? '-'}</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-primary/50 transition-colors group">
          <div className="text-sm text-muted-foreground font-medium mb-2">Leave Without Pay</div>
          <div className="flex justify-between items-baseline">
            <div className="text-2xl font-bold text-card-foreground group-hover:text-primary transition-colors">{balanceData?.leaveWithoutPay.taken ?? '-'}</div>
            <div className="text-xs text-muted-foreground">Taken</div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border bg-muted/30">
          <h2 className="text-lg font-bold text-card-foreground">Leave History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Leave Type</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Duration</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Reason</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Applied On</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="bg-transparent divide-y divide-border/50">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">Loading...</td></tr>
              ) : leaves.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">No leave history found.</td></tr>
              ) : (
                leaves.map((leave: any) => {
                  const days = Math.round((new Date(leave.toDate).getTime() - new Date(leave.fromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  return (
                    <tr key={leave._id} className="hover:bg-accent transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-card-foreground group-hover:text-accent-foreground">
                        {leave.leaveType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-muted-foreground group-hover:text-accent-foreground/80">{format(new Date(leave.fromDate), 'MMM dd, yyyy')} {leave.duration === 'multiple_days' ? `- ${format(new Date(leave.toDate), 'MMM dd, yyyy')}` : ''}</div>
                        <div className="text-xs text-muted-foreground group-hover:text-accent-foreground/70 mt-0.5">{leave.numberOfDays || days} Day{(leave.numberOfDays || days) !== 1 && 's'} {leave.duration === 'half_day' && `(${leave.halfDaySession === 'first_half' ? 'First Half' : 'Second Half'})`}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-muted-foreground group-hover:text-accent-foreground/80 max-w-xs truncate" title={leave.reason}>{leave.reason}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground group-hover:text-accent-foreground/80">
                        {format(new Date(leave.createdAt), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(leave.status)}
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
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-black/80 backdrop-blur-sm z-0" onClick={() => !isSubmitting && setIsModalOpen(false)} />

            <div className="relative z-10 inline-block w-full max-w-md px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-card border border-border rounded-2xl shadow-xl sm:my-8 sm:align-middle sm:p-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-5 border-b border-border pb-4">
                <h3 className="text-lg font-bold text-card-foreground">Apply for Leave</h3>
                <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">Leave Type</label>
                  <select
                    required
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors min-h-[44px]"
                    value={formData.leaveType}
                    onChange={(e) => setFormData({...formData, leaveType: e.target.value})}
                  >
                    <option value="" disabled>-- Select Leave Type --</option>
                    <option value="Sick Leave">Sick Leave</option>
                    <option value="Casual Leave">Casual Leave</option>
                    <option value="Compensatory Off">Compensatory Off</option>
                    <option value="Restricted Holiday">Restricted Holiday</option>
                    <option value="Maternity Leave">Maternity Leave</option>
                    <option value="Paternity Leave">Paternity Leave</option>
                    <option value="Leave Without Pay">Leave Without Pay</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1.5">From Date</label>
                    <input
                      type="date"
                      required
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors min-h-[44px]"
                      value={formData.fromDate}
                      onChange={(e) => {
                        const newFromDate = e.target.value;
                        setFormData(prev => ({
                          ...prev, 
                          fromDate: newFromDate,
                          toDate: prev.duration === 'half_day' || prev.duration === 'full_day' ? newFromDate : prev.toDate
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1.5">To Date</label>
                    <input
                      type="date"
                      required
                      disabled={formData.duration === 'half_day' || formData.duration === 'full_day'}
                      min={formData.fromDate || undefined}
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors disabled:opacity-50 min-h-[44px]"
                      value={formData.duration === 'half_day' || formData.duration === 'full_day' ? formData.fromDate : formData.toDate}
                      onChange={(e) => setFormData({...formData, toDate: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1.5">Duration</label>
                    <select
                      required
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors min-h-[44px]"
                      value={formData.duration}
                      onChange={(e) => {
                        const dur = e.target.value;
                        setFormData(prev => ({
                          ...prev, 
                          duration: dur, 
                          halfDaySession: dur === 'half_day' ? 'first_half' : '',
                          toDate: dur === 'half_day' || dur === 'full_day' ? prev.fromDate : prev.toDate
                        }));
                      }}
                    >
                      <option value="full_day">Full Day</option>
                      <option value="half_day">Half Day</option>
                      <option value="multiple_days">Multiple Days</option>
                    </select>
                  </div>

                  {formData.duration === 'half_day' && (
                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-1.5">Session</label>
                      <select
                        required
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors min-h-[44px]"
                        value={formData.halfDaySession}
                        onChange={(e) => setFormData({...formData, halfDaySession: e.target.value})}
                      >
                        <option value="first_half">First Half (Morning)</option>
                        <option value="second_half">Second Half (Afternoon)</option>
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">Reason</label>
                  <textarea
                    required
                    rows={3}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors resize-none"
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                    placeholder="Briefly describe the reason for your leave..."
                  ></textarea>
                </div>

                <div className="bg-muted p-4 rounded-xl border border-border">
                  <div className="text-sm text-muted-foreground">Total Leave Count:</div>
                  <div className="text-lg font-bold text-foreground">
                    {formData.duration === 'half_day' 
                      ? '0.5 Day' 
                      : (formData.fromDate && (formData.duration === 'full_day' ? formData.fromDate : formData.toDate) && new Date(formData.duration === 'full_day' ? formData.fromDate : formData.toDate) >= new Date(formData.fromDate) 
                          ? `${Math.ceil((new Date(formData.duration === 'full_day' ? formData.fromDate : formData.toDate).getTime() - new Date(formData.fromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} Day(s)` 
                          : '0 Day')}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">Supporting Documents</label>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-muted-foreground file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 text-sm transition-colors"
                    onChange={handleFileUpload}
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">Medical certificate required for Sick Leave &gt; 4 days.</p>
                  {formData.attachments.length > 0 && (
                    <div className="mt-2 text-sm text-green-500">{formData.attachments.length} file(s) attached</div>
                  )}
                </div>

                <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse border-t border-border pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full inline-flex justify-center items-center rounded-xl border border-transparent shadow-sm px-4 py-2 min-h-[44px] bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:ml-3 sm:w-auto disabled:opacity-50 transition-colors"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Submit Application'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                    className="mt-3 w-full inline-flex justify-center items-center rounded-xl border border-border shadow-sm px-4 py-2 min-h-[44px] bg-secondary text-sm font-bold text-secondary-foreground hover:bg-secondary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:mt-0 sm:w-auto disabled:opacity-50 transition-colors"
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
