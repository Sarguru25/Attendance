'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Search, Edit, Loader2, Save, X, Clock, Calendar } from 'lucide-react';
import { api } from '@/services/api';
import SalaryTimelineManager from './SalaryTimelineManager';
import { getSalaryForPayrollPeriod } from '@/lib/salaryUtils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function SalaryConfigurator() {
  const { data, error, isLoading, mutate } = useSWR('/api/admin/payroll/salaries', fetcher);
  const [search, setSearch] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Salary Timeline modal state
  const [selectedUserForTimeline, setSelectedUserForTimeline] = useState<any | null>(null);

  const users = data?.users || [];
  
  const filteredUsers = users.filter((u: any) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.employeeId?.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (user: any) => {
    setEditingId(user._id);
    setFormData({
      bankName: user.bankName || '',
      accountNumber: user.accountNumber || '',
      ifscCode: user.ifscCode || ''
    });
  };

  const handleSave = async () => {
    if (!editingId) return;
    setIsSaving(true);
    try {
      const res = await api(`/api/admin/payroll/salaries/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save');
      }
      mutate();
      setEditingId(null);
    } catch (error: any) {
      alert(`Error saving: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="relative max-w-md w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-border rounded-xl min-h-[44px] leading-5 bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-colors font-bold"
            placeholder="Search employee by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/30">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-[250px]">Employee</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Salary & Bank Details</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Deductions</th>
              <th scope="col" className="relative px-6 py-3 text-right"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground font-bold">Loading...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground font-bold">No employees found.</td></tr>
            ) : (
              filteredUsers.map((user: any) => {
                const isEditing = editingId === user._id;
                const timelineCount = user.salaryTimelines?.length || 0;

                return (
                  <tr key={user._id.toString()} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="ml-0">
                          <div className="text-sm font-bold text-card-foreground">{user.name}</div>
                          <div className="text-xs text-muted-foreground font-bold">{user.employeeId}</div>
                          <span className="px-2 py-1 bg-muted text-muted-foreground font-bold text-[10px] rounded-lg mt-1 inline-block border border-border">
                            {user.designation || user.role}
                          </span>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <div className="space-y-3 max-w-sm">
                          <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1">Bank Name</label>
                            <input 
                              type="text" 
                              className="w-full bg-background border border-border rounded-xl text-foreground px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" 
                              value={formData.bankName} 
                              onChange={e => setFormData({...formData, bankName: e.target.value})} 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1">Account Number</label>
                            <input 
                              type="text" 
                              className="w-full bg-background border border-border rounded-xl text-foreground px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" 
                              value={formData.accountNumber} 
                              onChange={e => setFormData({...formData, accountNumber: e.target.value})} 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1">IFSC Code</label>
                            <input 
                              type="text" 
                              className="w-full bg-background border border-border rounded-xl text-foreground px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" 
                              value={formData.ifscCode} 
                              onChange={e => setFormData({...formData, ifscCode: e.target.value})} 
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-sm font-bold text-card-foreground">
                            ₹{(user.monthlySalary || 0).toLocaleString()} <span className="text-[10px] text-muted-foreground font-normal">/ month</span>
                          </div>
                          {user.bankName || user.accountNumber ? (
                            <div className="text-xs text-muted-foreground">
                              <div>{user.bankName || 'No Bank'}</div>
                              <div>Acct: {user.accountNumber ? user.accountNumber.replace(/.(?=.{4})/g, '*') : 'N/A'}</div>
                              <div>IFSC: {user.ifscCode || 'N/A'}</div>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground italic">No bank details added</div>
                          )}
                          <button
                            onClick={() => setSelectedUserForTimeline(user)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold rounded-lg transition-colors"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            Salary Timeline ({timelineCount})
                          </button>
                        </div>
                      )}
                    </td>
                    
                    <td className="px-6 py-4">
                      {(() => {
                        const currentMonth = new Date().getMonth() + 1;
                        const currentYear = new Date().getFullYear();
                        const activeSalaryInfo = getSalaryForPayrollPeriod(user, currentMonth, currentYear);
                        const activeTimeline = activeSalaryInfo?.timeline;

                        const deductions: { label: string; amount: number; color?: string }[] = [];

                        if (activeTimeline?.esiDeduction && activeTimeline.esiDeduction > 0) {
                          deductions.push({ label: 'ESI', amount: activeTimeline.esiDeduction });
                        } else if (user.salaryDeductions?.esi?.enabled && user.salaryDeductions.esi.amount > 0) {
                          deductions.push({ label: 'ESI', amount: user.salaryDeductions.esi.amount });
                        }

                        if (activeTimeline?.rentalDeduction && activeTimeline.rentalDeduction > 0) {
                          deductions.push({ label: 'Rental', amount: activeTimeline.rentalDeduction });
                        } else if (user.salaryDeductions?.hra?.enabled && user.salaryDeductions.hra.amount > 0) {
                          deductions.push({ label: 'Rental', amount: user.salaryDeductions.hra.amount });
                        }

                        if (activeTimeline?.loanDeduction && activeTimeline.loanDeduction > 0) {
                          deductions.push({ label: 'Company Loan', amount: activeTimeline.loanDeduction, color: 'text-warning' });
                        } else if (user.salaryDeductions?.loan?.enabled) {
                          const monthlyLoan = user.salaryDeductions.loan.principalAmount && user.salaryDeductions.loan.totalMonths 
                            ? Math.round(user.salaryDeductions.loan.principalAmount / user.salaryDeductions.loan.totalMonths)
                            : (user.salaryDeductions.loan.monthlyDeduction || 0);
                          if (monthlyLoan > 0) {
                            deductions.push({ label: 'Company Loan', amount: monthlyLoan, color: 'text-warning' });
                          }
                        }

                        if (activeTimeline?.otherDeduction && activeTimeline.otherDeduction > 0) {
                          deductions.push({ label: 'Other', amount: activeTimeline.otherDeduction });
                        }

                        if (isEditing) {
                          return (
                            <div className="space-y-1.5 py-1">
                              {deductions.length === 0 ? (
                                <div className="text-muted-foreground italic font-normal text-xs">No active deductions</div>
                              ) : (
                                <div className="space-y-1">
                                  {deductions.map((d, i) => (
                                    <div key={i} className="text-xs font-bold flex items-center gap-1.5">
                                      <span className="text-muted-foreground">{d.label}:</span>
                                      <span className={d.color || 'text-foreground'}>₹{d.amount.toLocaleString('en-IN')}/m</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="text-[11px] text-muted-foreground font-medium pt-1">
                                Configure deductions in <span className="text-primary font-bold">Salary Timeline</span>
                              </div>
                            </div>
                          );
                        }

                        if (deductions.length === 0) {
                          return <div className="text-muted-foreground italic font-normal text-xs">No active deductions</div>;
                        }

                        return (
                          <div className="space-y-1">
                            {deductions.map((d, i) => (
                              <div key={i} className="text-xs font-bold flex items-center gap-1.5">
                                <span className="text-muted-foreground">{d.label}:</span>
                                <span className={d.color || 'text-foreground'}>₹{d.amount.toLocaleString('en-IN')}/m</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    
                    <td className="px-6 py-4 text-right">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <button onClick={handleSave} disabled={isSaving} className="w-full flex items-center justify-center bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-50">
                            {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />} Save
                          </button>
                          <button onClick={() => setEditingId(null)} disabled={isSaving} className="w-full flex items-center justify-center bg-muted text-foreground px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-accent disabled:opacity-50">
                            <X className="w-3 h-3 mr-1" /> Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handleEdit(user)} className="inline-flex items-center text-primary hover:text-primary/80 text-xs font-bold">
                          <Edit className="w-3 h-3 mr-1" /> Edit
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

      {/* Salary Timeline Manager Modal */}
      {selectedUserForTimeline && (
        <SalaryTimelineManager
          user={selectedUserForTimeline}
          onClose={() => setSelectedUserForTimeline(null)}
          onUpdate={() => {
            mutate();
            // Update selected user object if open
            const updatedUser = users.find((u: any) => u._id === selectedUserForTimeline._id);
            if (updatedUser) setSelectedUserForTimeline(updatedUser);
          }}
        />
      )}
    </div>
  );
}
