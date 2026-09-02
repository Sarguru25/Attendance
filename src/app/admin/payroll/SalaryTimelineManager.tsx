'use client';

import { useState } from 'react';
import { Plus, Edit2, Trash2, Calendar, DollarSign, X, Check, Loader2, AlertCircle, Clock } from 'lucide-react';
import { api } from '@/services/api';
import { computeTimelineDisplayList, ISalaryTimeline, ITimelineDisplayItem } from '@/lib/salaryUtils';

interface SalaryTimelineManagerProps {
  user: any;
  onClose: () => void;
  onUpdate: () => void;
}

export default function SalaryTimelineManager({ user, onClose, onUpdate }: SalaryTimelineManagerProps) {
  const [timelines, setTimelines] = useState<ISalaryTimeline[]>(user.salaryTimelines || []);
  const [isAdding, setIsAdding] = useState(false);
  const [editingTimelineId, setEditingTimelineId] = useState<string | null>(null);
  
  // Form state
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [monthlySalary, setMonthlySalary] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Compute display items with automatic sorting, Effective To calculation, and status tagging
  const displayItems: ITimelineDisplayItem[] = computeTimelineDisplayList(timelines);

  const resetForm = () => {
    setEffectiveFrom('');
    setMonthlySalary('');
    setIsAdding(false);
    setEditingTimelineId(null);
    setError(null);
  };

  const handleStartAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleStartEdit = (item: ITimelineDisplayItem) => {
    setError(null);
    setEditingTimelineId(item._id || null);
    setEffectiveFrom(item.effectiveFrom);
    setMonthlySalary(String(item.monthlySalary));
    setIsAdding(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const salaryNum = Number(monthlySalary);
    if (!monthlySalary || isNaN(salaryNum) || salaryNum <= 0) {
      setError('Monthly Salary must be greater than 0');
      return;
    }

    if (!effectiveFrom) {
      setError('Please select a valid Effective From date');
      return;
    }

    setIsLoading(true);

    try {
      if (editingTimelineId) {
        // Edit existing timeline
        const res = await api(`/api/admin/employees/${user._id}/salary-timelines`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timelineId: editingTimelineId,
            effectiveFrom,
            monthlySalary: salaryNum
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update salary timeline');

        setTimelines(data.salaryTimelines || []);
        setSuccess('Salary timeline updated successfully');
      } else {
        // Add new timeline
        const res = await api(`/api/admin/employees/${user._id}/salary-timelines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            effectiveFrom,
            monthlySalary: salaryNum
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add salary timeline');

        setTimelines(data.salaryTimelines || []);
        setSuccess('Salary timeline added successfully');
      }

      resetForm();
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (item: ITimelineDisplayItem) => {
    if (!item._id) return;
    if (!confirm(`Are you sure you want to delete the salary timeline effective from ${item.effectiveFromFormatted}?`)) return;

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const res = await api(`/api/admin/employees/${user._id}/salary-timelines?timelineId=${item._id}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete salary timeline');

      setTimelines(data.salaryTimelines || []);
      setSuccess('Salary timeline deleted successfully');
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border text-card-foreground rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Salary Timeline Configuration
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Employee: <span className="font-bold text-foreground">{user.name}</span> ({user.employeeId}) &bull; {user.designation || user.role}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Alerts */}
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 text-sm font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Top Bar with Add Button */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Salary History</h3>
            {!isAdding && !editingTimelineId && (
              <button
                onClick={handleStartAdd}
                className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-sm hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Salary Timeline
              </button>
            )}
          </div>

          {/* Form (Add or Edit) */}
          {(isAdding || editingTimelineId) && (
            <form onSubmit={handleSave} className="bg-muted/40 p-5 border border-border rounded-xl space-y-4">
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                {editingTimelineId ? 'Edit Salary Timeline' : 'Add New Salary Timeline'}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">
                    Effective From <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full bg-background border border-border rounded-xl text-foreground px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">
                    Monthly Salary (₹) <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">₹</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      placeholder="e.g. 17000"
                      className="w-full bg-background border border-border rounded-xl text-foreground pl-7 pr-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                      value={monthlySalary}
                      onChange={(e) => setMonthlySalary(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isLoading}
                  className="px-4 py-2 bg-muted text-foreground text-xs font-bold rounded-xl hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 transition-colors flex items-center disabled:opacity-50 shadow-sm"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                  Save Salary Timeline
                </button>
              </div>
            </form>
          )}

          {/* Timelines Table */}
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/40">
                <tr>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Effective From
                  </th>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Effective To
                  </th>
                  <th scope="col" className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Monthly Salary
                  </th>
                  <th scope="col" className="px-5 py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {displayItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground font-semibold">
                      No salary timelines configured. Click &quot;Add Salary Timeline&quot; to define salary history.
                    </td>
                  </tr>
                ) : (
                  displayItems.map((item) => {
                    const isBeingEdited = editingTimelineId === item._id;

                    return (
                      <tr
                        key={item._id || item.effectiveFrom}
                        className={`hover:bg-muted/30 transition-colors ${
                          isBeingEdited ? 'bg-primary/5' : ''
                        }`}
                      >
                        <td className="px-5 py-4 text-sm font-bold text-foreground whitespace-nowrap">
                          {item.effectiveFromFormatted}
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap font-medium">
                          {item.effectiveToFormatted}
                        </td>
                        <td className="px-5 py-4 text-sm font-bold text-foreground text-right whitespace-nowrap">
                          ₹{item.monthlySalary.toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          {item.status === 'Current' && (
                            <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold rounded-full">
                              Current
                            </span>
                          )}
                          {item.status === 'Historical' && (
                            <span className="px-2.5 py-1 bg-muted text-muted-foreground border border-border text-xs font-bold rounded-full">
                              Historical
                            </span>
                          )}
                          {item.status === 'Future' && (
                            <span className="px-2.5 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 text-xs font-bold rounded-full">
                              Future
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleStartEdit(item)}
                              disabled={isLoading}
                              className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Edit timeline"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              disabled={isLoading}
                              className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Delete timeline"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-muted text-foreground text-sm font-bold rounded-xl hover:bg-accent transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
