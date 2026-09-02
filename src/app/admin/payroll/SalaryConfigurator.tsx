'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Search, Edit, Loader2, Save, X, Clock, Calendar } from 'lucide-react';
import { api } from '@/services/api';
import SalaryTimelineManager from './SalaryTimelineManager';

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
    
    const salary = Number(user.monthlySalary) || 0;
    const isIntern = user.role === 'intern';
    const isEsiEligible = salary <= 21000;
    
    // ESI initial state: default to FALSE for intern, TRUE for employee (if <= 21k)
    let esiEnabled = false;
    if (isEsiEligible) {
      if (user.salaryDeductions?.esi?.enabled !== undefined) {
        esiEnabled = Boolean(user.salaryDeductions.esi.enabled);
      } else {
        esiEnabled = !isIntern;
      }
    }
    const calculatedEsi = esiEnabled ? Math.round(salary * 0.0075) : 0;

    setFormData({
      userRole: user.role,
      monthlySalary: user.monthlySalary || 0,
      bankName: user.bankName || '',
      accountNumber: user.accountNumber || '',
      ifscCode: user.ifscCode || '',
      salaryDeductions: {
        esi: {
          enabled: esiEnabled,
          amount: calculatedEsi
        },
        hra: {
          enabled: user.salaryDeductions?.hra?.enabled || false,
          amount: user.salaryDeductions?.hra?.amount || 0
        },
        loan: {
          enabled: user.salaryDeductions?.loan?.enabled || false,
          principalAmount: user.salaryDeductions?.loan?.principalAmount || 0,
          totalMonths: user.salaryDeductions?.loan?.totalMonths || 0,
          startDate: user.salaryDeductions?.loan?.startDate ? new Date(user.salaryDeductions.loan.startDate).toISOString().split('T')[0] : '',
          endDate: user.salaryDeductions?.loan?.endDate ? new Date(user.salaryDeductions.loan.endDate).toISOString().split('T')[0] : ''
        }
      }
    });
  };

  const handleSalaryChange = (newSalary: number) => {
    const isEsiEligible = newSalary <= 21000;
    
    setFormData((prev: any) => {
      const willEnableEsi = isEsiEligible ? Boolean(prev.salaryDeductions.esi.enabled) : false;
      const esiAmt = willEnableEsi ? Math.round(newSalary * 0.0075) : 0;
      return {
        ...prev,
        monthlySalary: newSalary,
        salaryDeductions: {
          ...prev.salaryDeductions,
          esi: {
            enabled: willEnableEsi,
            amount: esiAmt
          }
        }
      };
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
                            <label className="block text-xs font-bold text-muted-foreground mb-1">Monthly Salary (₹)</label>
                            <input 
                              type="number" 
                              className="w-full bg-background border border-border rounded-xl text-foreground px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" 
                              value={formData.monthlySalary} 
                              onChange={e => handleSalaryChange(Number(e.target.value))} 
                            />
                          </div>
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
                      {isEditing ? (
                        <div className="space-y-4 max-w-sm">
                          {/* ESI Deduction Toggle */}
                          <div className="bg-muted/30 p-3 rounded-xl border border-border">
                            <div className="flex items-center justify-between mb-1">
                              <div>
                                <span className="text-xs font-bold text-foreground">ESI</span>
                                {formData.monthlySalary > 21000 ? (
                                  <span className="text-[10px] text-muted-foreground block font-medium">Disabled (Salary &gt; ₹21,000)</span>
                                ) : formData.salaryDeductions.esi.enabled ? (
                                  <span className="text-[10px] text-muted-foreground block font-medium">
                                    Enabled: ₹{formData.salaryDeductions.esi.amount}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground block font-medium">
                                    Disabled {formData.userRole === 'intern' ? '(Default for Interns)' : ''}
                                  </span>
                                )}
                              </div>
                              <label className="flex items-center cursor-pointer">
                                <div className="relative">
                                  <input 
                                    type="checkbox" 
                                    disabled={formData.monthlySalary > 21000}
                                    className="sr-only" 
                                    checked={formData.salaryDeductions.esi.enabled} 
                                    onChange={e => {
                                      const enabled = e.target.checked;
                                      const esiAmt = enabled ? Math.round(formData.monthlySalary * 0.0075) : 0;
                                      setFormData({
                                        ...formData, 
                                        salaryDeductions: {
                                          ...formData.salaryDeductions, 
                                          esi: { enabled, amount: esiAmt }
                                        }
                                      });
                                    }} 
                                  />
                                  <div className={`block w-8 h-5 rounded-full transition-colors ${formData.salaryDeductions.esi.enabled ? 'bg-primary' : 'bg-muted border border-border'}`}></div>
                                  <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${formData.salaryDeductions.esi.enabled ? 'transform translate-x-3' : ''}`}></div>
                                </div>
                              </label>
                            </div>
                          </div>
                          
                          {/* Rental Deduction */}
                          <div className="bg-muted/30 p-3 rounded-xl border border-border">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-foreground">Rental Deduction</span>
                              <label className="flex items-center cursor-pointer">
                                <div className="relative">
                                  <input type="checkbox" className="sr-only" checked={formData.salaryDeductions.hra.enabled} onChange={e => setFormData({...formData, salaryDeductions: {...formData.salaryDeductions, hra: {...formData.salaryDeductions.hra, enabled: e.target.checked}}})} />
                                  <div className={`block w-8 h-5 rounded-full transition-colors ${formData.salaryDeductions.hra.enabled ? 'bg-primary' : 'bg-muted border border-border'}`}></div>
                                  <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${formData.salaryDeductions.hra.enabled ? 'transform translate-x-3' : ''}`}></div>
                                </div>
                              </label>
                            </div>
                            <input 
                              type="number" 
                              disabled={!formData.salaryDeductions.hra.enabled}
                              className="w-full bg-background border border-border rounded-lg text-foreground px-2 py-1 text-xs focus:ring-1 focus:ring-primary outline-none disabled:opacity-50" 
                              value={formData.salaryDeductions.hra.amount} 
                              onChange={e => setFormData({...formData, salaryDeductions: {...formData.salaryDeductions, hra: {...formData.salaryDeductions.hra, amount: Number(e.target.value)}}})} 
                              placeholder="Amount (₹)"
                            />
                          </div>

                          {/* Loan */}
                          <div className="bg-muted/30 p-3 rounded-xl border border-border">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-foreground">Company Loan</span>
                              <label className="flex items-center cursor-pointer">
                                <div className="relative">
                                  <input type="checkbox" className="sr-only" checked={formData.salaryDeductions.loan.enabled} onChange={e => setFormData({...formData, salaryDeductions: {...formData.salaryDeductions, loan: {...formData.salaryDeductions.loan, enabled: e.target.checked}}})} />
                                  <div className={`block w-8 h-5 rounded-full transition-colors ${formData.salaryDeductions.loan.enabled ? 'bg-primary' : 'bg-muted border border-border'}`}></div>
                                  <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${formData.salaryDeductions.loan.enabled ? 'transform translate-x-3' : ''}`}></div>
                                </div>
                              </label>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <div>
                                <label className="text-[10px] text-muted-foreground block mb-0.5">Principal (₹)</label>
                                <input type="number" disabled={!formData.salaryDeductions.loan.enabled} className="w-full bg-background border border-border rounded-lg text-foreground px-2 py-1 text-xs outline-none disabled:opacity-50" value={formData.salaryDeductions.loan.principalAmount} onChange={e => setFormData({...formData, salaryDeductions: {...formData.salaryDeductions, loan: {...formData.salaryDeductions.loan, principalAmount: Number(e.target.value)}}})} />
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground block mb-0.5">Months</label>
                                <input type="number" disabled={!formData.salaryDeductions.loan.enabled} className="w-full bg-background border border-border rounded-lg text-foreground px-2 py-1 text-xs outline-none disabled:opacity-50" value={formData.salaryDeductions.loan.totalMonths} onChange={e => setFormData({...formData, salaryDeductions: {...formData.salaryDeductions, loan: {...formData.salaryDeductions.loan, totalMonths: Number(e.target.value)}}})} />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-muted-foreground block mb-0.5">Start Date</label>
                                <input type="date" disabled={!formData.salaryDeductions.loan.enabled} className="w-full bg-background border border-border rounded-lg text-foreground px-1 py-1 text-[10px] outline-none disabled:opacity-50" value={formData.salaryDeductions.loan.startDate} onChange={e => setFormData({...formData, salaryDeductions: {...formData.salaryDeductions, loan: {...formData.salaryDeductions.loan, startDate: e.target.value}}})} />
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground block mb-0.5">End Date</label>
                                <input type="date" disabled={!formData.salaryDeductions.loan.enabled} className="w-full bg-background border border-border rounded-lg text-foreground px-1 py-1 text-[10px] outline-none disabled:opacity-50" value={formData.salaryDeductions.loan.endDate} onChange={e => setFormData({...formData, salaryDeductions: {...formData.salaryDeductions, loan: {...formData.salaryDeductions.loan, endDate: e.target.value}}})} />
                              </div>
                            </div>
                          </div>

                        </div>
                      ) : (
                        (() => {
                          const isEsiActive = Boolean(user.salaryDeductions?.esi?.enabled) && (user.monthlySalary || 0) <= 21000 && (user.salaryDeductions?.esi?.amount || 0) > 0;
                          const isHraActive = Boolean(user.salaryDeductions?.hra?.enabled) && (user.salaryDeductions?.hra?.amount || 0) > 0;
                          const isLoanActive = Boolean(user.salaryDeductions?.loan?.enabled) && (user.salaryDeductions?.loan?.remainingMonths || 0) > 0;

                          if (!isEsiActive && !isHraActive && !isLoanActive) {
                            return <div className="text-muted-foreground italic font-normal text-xs">No active deductions</div>;
                          }

                          return (
                            <div className="text-xs space-y-1 font-bold">
                              {isEsiActive && (
                                <div className="text-foreground flex justify-between">
                                  <span>ESI</span> <span>₹{user.salaryDeductions.esi.amount}</span>
                                </div>
                              )}
                              {isHraActive && (
                                <div className="text-destructive flex justify-between">
                                  <span>Rental Deduction</span> <span>₹{user.salaryDeductions.hra.amount}</span>
                                </div>
                              )}
                              {isLoanActive && (
                                <div className="text-warning flex flex-col mt-1">
                                  <div className="flex justify-between">
                                    <span>Loan (₹{Math.round(user.salaryDeductions.loan.monthlyDeduction || 0)}/m)</span>
                                    <span>{user.salaryDeductions.loan.remainingMonths}/{user.salaryDeductions.loan.totalMonths} mos left</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()
                      )}
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
