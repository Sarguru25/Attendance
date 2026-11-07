'use client';

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Clock,
  CalendarDays,
  Calendar,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Info
} from 'lucide-react';
import {
  IWorkingDayConfig,
  SaturdayRule,
  getDefaultWorkingDayConfig,
  ensureWorkingDaysArray,
  formatShiftWorkingDays,
  getMonthCalendarPreview,
  getWorkingDaysSummary
} from '@/lib/workingDays';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_KEYS = [
  { key: 'MONDAY', label: 'Mon' },
  { key: 'TUESDAY', label: 'Tue' },
  { key: 'WEDNESDAY', label: 'Wed' },
  { key: 'THURSDAY', label: 'Thu' },
  { key: 'FRIDAY', label: 'Fri' },
  { key: 'SUNDAY', label: 'Sun' }
];

interface IShiftSessionData {
  order: number;
  startTime: string;
  endTime: string;
  graceTime: number;
}

interface IShiftRecord {
  _id: string;
  shiftName: string;
  sessions?: IShiftSessionData[];
  firstHalf?: { startTime: string; endTime: string };
  secondHalf?: { startTime: string; endTime: string };
  workingDayConfig?: IWorkingDayConfig;
  workingDays?: string[];
  isActive?: boolean;
  startTime?: string;
  endTime?: string;
  graceTime?: number;
}

export default function ShiftsClient() {
  const [shifts, setShifts] = useState<IShiftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    shiftName: string;
    sessions: IShiftSessionData[];
    firstHalf: { startTime: string; endTime: string };
    secondHalf: { startTime: string; endTime: string };
    workingDayConfig: IWorkingDayConfig;
    workingDays: string[];
    isActive: boolean;
  }>({
    shiftName: '',
    sessions: [
      { order: 1, startTime: '09:00', endTime: '13:00', graceTime: 15 },
      { order: 2, startTime: '13:30', endTime: '18:00', graceTime: 0 }
    ],
    firstHalf: { startTime: '09:00', endTime: '13:30' },
    secondHalf: { startTime: '13:30', endTime: '18:00' },
    workingDayConfig: getDefaultWorkingDayConfig(),
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    isActive: true
  });

  // Calendar preview month/year state
  const [previewDate, setPreviewDate] = useState(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1
    };
  });

  const refreshShifts = async () => {
    try {
      const res = await axios.get('/api/shifts');
      setShifts(res.data.shifts || []);
    } catch {
      toast.error('Failed to load shifts');
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await axios.get('/api/shifts');
        if (isMounted) {
          setShifts(res.data.shifts || []);
        }
      } catch {
        if (isMounted) {
          toast.error('Failed to load shifts');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenModal = (shift: IShiftRecord | null = null) => {
    if (shift) {
      setEditingId(shift._id);
      const sess = shift.sessions && shift.sessions.length > 0
        ? shift.sessions.map((s, idx) => ({
            order: s.order || idx + 1,
            startTime: s.startTime || '09:00',
            endTime: s.endTime || '13:00',
            graceTime: s.graceTime || 0
          }))
        : [
            { order: 1, startTime: shift.startTime || '09:00', endTime: '13:00', graceTime: shift.graceTime || 0 },
            { order: 2, startTime: '13:30', endTime: shift.endTime || '18:00', graceTime: 0 }
          ];

      const resolvedConfig: IWorkingDayConfig = shift.workingDayConfig || {
        regularWorkingDays: (shift.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])
          .filter((d: string) => !['Saturday', 'Sunday'].includes(d))
          .map((d: string) => d.toUpperCase()),
        saturdayRule: (shift.workingDays || []).includes('Saturday') ? 'SECOND_SATURDAY_ONLY' : 'ALL_SATURDAYS_OFF',
        sundayWorking: (shift.workingDays || []).includes('Sunday'),
        customSaturdays: [2]
      };

      setFormData({
        shiftName: shift.shiftName,
        sessions: sess,
        firstHalf: {
          startTime: shift.firstHalf?.startTime || sess[0]?.startTime || '09:00',
          endTime: shift.firstHalf?.endTime || sess[0]?.endTime || '13:30'
        },
        secondHalf: {
          startTime: shift.secondHalf?.startTime || sess[1]?.startTime || '13:30',
          endTime: shift.secondHalf?.endTime || sess[sess.length - 1]?.endTime || '18:00'
        },
        workingDayConfig: resolvedConfig,
        workingDays: shift.workingDays || ensureWorkingDaysArray(resolvedConfig),
        isActive: shift.isActive !== undefined ? shift.isActive : true
      });
    } else {
      setEditingId(null);
      const defConfig = getDefaultWorkingDayConfig();
      setFormData({
        shiftName: '',
        sessions: [
          { order: 1, startTime: '09:00', endTime: '13:00', graceTime: 15 },
          { order: 2, startTime: '13:30', endTime: '18:00', graceTime: 0 }
        ],
        firstHalf: { startTime: '09:00', endTime: '13:30' },
        secondHalf: { startTime: '13:30', endTime: '18:00' },
        workingDayConfig: defConfig,
        workingDays: ensureWorkingDaysArray(defConfig),
        isActive: true
      });
    }

    // Reset preview to current month when modal opens
    const now = new Date();
    setPreviewDate({ year: now.getFullYear(), month: now.getMonth() + 1 });
    setIsModalOpen(true);
  };

  // Toggle regular working days (Mon-Fri) or Sunday
  const handleWeekdayButtonClick = (key: string) => {
    setFormData(prev => {
      const config = { ...prev.workingDayConfig };

      if (key === 'SUNDAY') {
        config.sundayWorking = !config.sundayWorking;
      } else {
        const curReg = config.regularWorkingDays || [];
        if (curReg.includes(key)) {
          config.regularWorkingDays = curReg.filter(d => d !== key);
        } else {
          config.regularWorkingDays = [...curReg, key];
        }
      }

      return {
        ...prev,
        workingDayConfig: config,
        workingDays: ensureWorkingDaysArray(config)
      };
    });
  };

  const handleToggleCustomSaturday = (satNumber: number) => {
    setFormData(prev => {
      const cur = prev.workingDayConfig.customSaturdays || [];
      const updated = cur.includes(satNumber)
        ? cur.filter(n => n !== satNumber)
        : [...cur, satNumber].sort((a, b) => a - b);

      let derivedRule: SaturdayRule = 'CUSTOM';
      if (updated.length === 5) derivedRule = 'ALL_SATURDAYS_WORKING';
      else if (updated.length === 0) derivedRule = 'ALL_SATURDAYS_OFF';
      else if (updated.length === 1 && updated[0] === 2) derivedRule = 'SECOND_SATURDAY_ONLY';
      else if (updated.length === 2 && updated.includes(1) && updated.includes(3)) derivedRule = 'FIRST_THIRD_SATURDAYS';
      else if (updated.length === 3 && updated.includes(1) && updated.includes(3) && updated.includes(5)) derivedRule = 'ALTERNATE_SATURDAYS';

      const config: IWorkingDayConfig = {
        ...prev.workingDayConfig,
        saturdayRule: derivedRule,
        customSaturdays: updated
      };

      return {
        ...prev,
        workingDayConfig: config,
        workingDays: ensureWorkingDaysArray(config)
      };
    });
  };

  const addSession = () => {
    const nextOrder = formData.sessions.length + 1;
    setFormData({
      ...formData,
      sessions: [
        ...formData.sessions,
        { order: nextOrder, startTime: '14:00', endTime: '18:00', graceTime: 0 }
      ]
    });
  };

  const removeSession = (index: number) => {
    if (formData.sessions.length <= 1) {
      toast.error('At least one session is required');
      return;
    }
    const updated = formData.sessions.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }));
    setFormData({ ...formData, sessions: updated });
  };

  const updateSession = (index: number, field: keyof IShiftSessionData, value: string | number) => {
    const newSessions = [...formData.sessions];
    newSessions[index] = { ...newSessions[index], [field]: value };
    setFormData({ ...formData, sessions: newSessions });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const config = formData.workingDayConfig;
    const hasAnyWorkingDays =
      (config.regularWorkingDays && config.regularWorkingDays.length > 0) ||
      config.saturdayRule !== 'ALL_SATURDAYS_OFF' ||
      config.sundayWorking;

    if (!formData.shiftName || !hasAnyWorkingDays) {
      toast.error('Please provide a name and at least one working day');
      return;
    }

    const payload = {
      ...formData,
      workingDays: ensureWorkingDaysArray(config)
    };

    try {
      if (editingId) {
        await axios.put(`/api/shifts/${editingId}`, payload);
        toast.success('Shift updated successfully');
      } else {
        await axios.post('/api/shifts', payload);
        toast.success('Shift created successfully');
      }
      setIsModalOpen(false);
      refreshShifts();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        toast.error(err.response?.data?.error || 'Failed to save shift');
      } else {
        toast.error('Failed to save shift');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) return;
    try {
      await axios.delete(`/api/shifts/${id}`);
      toast.success('Shift deleted');
      refreshShifts();
    } catch {
      toast.error('Failed to delete shift');
    }
  };

  // Preview computations
  const previewDays = useMemo(() => {
    return getMonthCalendarPreview(
      previewDate.year,
      previewDate.month,
      formData.workingDayConfig
    );
  }, [previewDate.year, previewDate.month, formData.workingDayConfig]);

  const previewSummary = useMemo(() => {
    return getWorkingDaysSummary(
      previewDate.year,
      previewDate.month,
      formData.workingDayConfig
    );
  }, [previewDate.year, previewDate.month, formData.workingDayConfig]);

  // First day weekday offset (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const firstDayWeekday = useMemo(() => {
    return new Date(previewDate.year, previewDate.month - 1, 1).getDay();
  }, [previewDate.year, previewDate.month]);

  const handlePrevMonth = () => {
    setPreviewDate(prev => {
      if (prev.month === 1) {
        return { year: prev.year - 1, month: 12 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setPreviewDate(prev => {
      if (prev.month === 12) {
        return { year: prev.year + 1, month: 1 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  if (loading) {
    return <div className="text-foreground font-bold text-center p-6">Loading shifts...</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Shift Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure Recurring Working Days, Punch Sessions, and Half-Day Split Timings
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 min-h-[44px] rounded-xl font-bold flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> New Shift
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-x-auto shadow-sm">
        <table className="w-full text-left text-sm whitespace-nowrap min-w-[950px]">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="px-6 py-3 font-bold">Shift Name</th>
              <th className="px-6 py-3 font-bold">Punch Sessions</th>
              <th className="px-6 py-3 font-bold">Half-Day Split Timings</th>
              <th className="px-6 py-3 font-bold">Working Days & Rule</th>
              <th className="px-6 py-3 font-bold">Status</th>
              <th className="px-6 py-3 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shifts.map(s => {
              const fh = s.firstHalf || {
                startTime: s.sessions?.[0]?.startTime || s.startTime || '09:00',
                endTime: s.sessions?.[0]?.endTime || '13:30'
              };
              const sh = s.secondHalf || {
                startTime: s.sessions?.[1]?.startTime || '13:30',
                endTime: s.sessions?.[s.sessions?.length - 1]?.endTime || s.endTime || '18:00'
              };

              return (
                <tr key={s._id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-card-foreground align-middle">
                    {s.shiftName}
                  </td>
                  <td className="px-6 py-4 text-card-foreground align-middle">
                    <div className="flex flex-col gap-1">
                      {s.sessions?.map((sess: IShiftSessionData, idx: number) => (
                        <div
                          key={idx}
                          className="inline-flex items-center text-xs bg-muted/80 text-foreground p-1 px-2.5 rounded-md border border-border font-bold"
                        >
                          <Clock className="w-3 h-3 mr-1 text-primary" /> Session {sess.order}: {sess.startTime} - {sess.endTime}{' '}
                          {sess.graceTime > 0 ? `(${sess.graceTime}m grace)` : ''}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-card-foreground align-middle">
                    <div className="flex flex-col gap-1 text-xs font-bold">
                      <div className="text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">
                        1st Half: {fh.startTime} - {fh.endTime}
                      </div>
                      <div className="text-secondary-foreground bg-secondary/80 px-2.5 py-1 rounded-md border border-border">
                        2nd Half: {sh.startTime} - {sh.endTime}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-lg border border-primary/30 font-bold w-fit block">
                      {formatShiftWorkingDays(s)}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <span
                      className={`px-2 py-1 text-xs rounded-full font-bold ${
                        s.isActive
                          ? 'bg-success/20 text-success'
                          : 'bg-destructive/20 text-destructive'
                      }`}
                    >
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right align-middle">
                    <button
                      onClick={() => handleOpenModal(s)}
                      className="text-primary hover:text-primary/80 p-1 transition-colors"
                      title="Edit Shift"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(s._id)}
                      className="text-destructive hover:text-destructive/80 p-1 ml-2 transition-colors"
                      title="Delete Shift"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {shifts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground font-bold">
                  No shifts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SHIFT CONFIGURATION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl max-w-3xl w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 border-b border-border pb-3">
              <div>
                <h2 className="text-xl font-bold text-card-foreground">
                  {editingId ? 'Edit Shift Configuration' : 'Create New Shift'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure punch sessions, split timings, and recurring working days
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* SHIFT NAME */}
              <div>
                <label className="block text-sm font-bold text-card-foreground mb-1">
                  Shift Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Regular Day Shift"
                  value={formData.shiftName}
                  onChange={e => setFormData({ ...formData, shiftName: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl min-h-[44px] p-2.5 text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>

              {/* SECTION 1: PUNCH SESSIONS */}
              <div className="p-4 border border-border rounded-xl bg-muted/20 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="text-sm font-bold text-card-foreground flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-primary" /> Check-In / Check-Out Punch Sessions
                  </div>
                  <button
                    type="button"
                    onClick={addSession}
                    className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Punch Session
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.sessions.map((sess, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-background border border-border rounded-xl relative space-y-2"
                    >
                      <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
                        <span>Session {sess.order}</span>
                        {formData.sessions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSession(idx)}
                            className="text-destructive hover:text-destructive/80 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-card-foreground mb-1">
                            Start Time
                          </label>
                          <input
                            type="time"
                            required
                            value={sess.startTime}
                            onChange={e => updateSession(idx, 'startTime', e.target.value)}
                            className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-card-foreground mb-1">
                            End Time
                          </label>
                          <input
                            type="time"
                            required
                            value={sess.endTime}
                            onChange={e => updateSession(idx, 'endTime', e.target.value)}
                            className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-card-foreground mb-1">
                            Grace (mins)
                          </label>
                          <input
                            type="number"
                            min="0"
                            required
                            value={sess.graceTime}
                            onChange={e =>
                              updateSession(idx, 'graceTime', parseInt(e.target.value) || 0)
                            }
                            className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 2: HALF-DAY SPLIT TIMINGS */}
              <div className="p-4 border border-primary/30 rounded-xl bg-primary/5 space-y-4">
                <div className="text-sm font-bold text-primary flex items-center">
                  <CalendarDays className="w-4 h-4 mr-2" /> Half-Day Split Timings (For Leave & Calendar)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-background border border-border rounded-xl space-y-2">
                    <div className="text-xs font-bold text-primary">First Half Timing</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                          Start Time
                        </label>
                        <input
                          type="time"
                          required
                          value={formData.firstHalf.startTime}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              firstHalf: { ...formData.firstHalf, startTime: e.target.value }
                            })
                          }
                          className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                          End Time
                        </label>
                        <input
                          type="time"
                          required
                          value={formData.firstHalf.endTime}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              firstHalf: { ...formData.firstHalf, endTime: e.target.value }
                            })
                          }
                          className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-background border border-border rounded-xl space-y-2">
                    <div className="text-xs font-bold text-card-foreground">Second Half Timing</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                          Start Time
                        </label>
                        <input
                          type="time"
                          required
                          value={formData.secondHalf.startTime}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              secondHalf: { ...formData.secondHalf, startTime: e.target.value }
                            })
                          }
                          className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                          End Time
                        </label>
                        <input
                          type="time"
                          required
                          value={formData.secondHalf.endTime}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              secondHalf: { ...formData.secondHalf, endTime: e.target.value }
                            })
                          }
                          className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: RECURRING WORKING DAYS CONFIGURATION */}
              <div className="p-4 border border-border rounded-xl bg-card space-y-5">
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="text-sm font-bold text-card-foreground">
                        Recurring Working Days Configuration
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Configured once. Automatically calculated for every month without monthly setup.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3A: REGULAR WORKING DAYS */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-card-foreground">
                      Regular Working Days
                    </label>
                    <span className="text-[11px] text-muted-foreground">
                      Default: Mon, Tue, Wed, Thu, Fri
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_KEYS.map(({ key, label }) => {
                      const isSunday = key === 'SUNDAY';
                      const isSelected = isSunday
                        ? formData.workingDayConfig.sundayWorking
                        : (formData.workingDayConfig.regularWorkingDays || []).includes(key);

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleWeekdayButtonClick(key)}
                          className={`px-4 py-2 min-h-[38px] rounded-xl text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-primary text-primary-foreground border border-primary shadow-sm hover:bg-primary/90'
                              : 'bg-muted text-muted-foreground border border-border hover:border-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3B: SELECT WORKING SATURDAYS OF THE MONTH */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-card-foreground">
                    Select Working Saturdays of the Month:
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map(num => {
                      const isChecked = (
                        formData.workingDayConfig.customSaturdays || []
                      ).includes(num);
                      const suffix =
                        num === 1 ? '1st' : num === 2 ? '2nd' : num === 3 ? '3rd' : `${num}th`;
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleToggleCustomSaturday(num)}
                          className={`px-4 py-2 min-h-[38px] rounded-xl text-xs font-bold border transition-all ${
                            isChecked
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm hover:bg-primary/90'
                              : 'bg-muted text-muted-foreground border border-border hover:border-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {suffix} Sat
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3D: DYNAMIC MONTHLY CALENDAR PREVIEW */}
                <div className="p-4 border border-primary/30 rounded-xl bg-primary/5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <div>
                        <div className="text-xs font-bold text-foreground">
                          Monthly Calendar Preview
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Dynamic calendar verification — working days highlighted in yellow/orange
                        </div>
                      </div>
                    </div>

                    {/* Month and Year navigation */}
                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="p-1 rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors"
                        title="Previous Month"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <select
                        value={previewDate.month}
                        onChange={e =>
                          setPreviewDate({ ...previewDate, month: parseInt(e.target.value, 10) })
                        }
                        className="bg-background border border-border rounded-lg text-xs font-bold text-foreground px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {MONTH_NAMES.map((name, idx) => (
                          <option key={name} value={idx + 1}>
                            {name}
                          </option>
                        ))}
                      </select>

                      <select
                        value={previewDate.year}
                        onChange={e =>
                          setPreviewDate({ ...previewDate, year: parseInt(e.target.value, 10) })
                        }
                        className="bg-background border border-border rounded-lg text-xs font-bold text-foreground px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(yr => (
                          <option key={yr} value={yr}>
                            {yr}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={handleNextMonth}
                        className="p-1 rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors"
                        title="Next Month"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Strip & Legend */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-background/80 p-2.5 rounded-lg border border-border">
                    <div className="font-bold text-card-foreground">
                      {MONTH_NAMES[previewDate.month - 1]} {previewDate.year}:{' '}
                      <span className="text-primary font-bold">
                        {previewSummary.workingDays} Working Days
                      </span>{' '}
                      •{' '}
                      <span className="text-muted-foreground font-bold">
                        {previewSummary.weeklyOffs} Weekly Offs
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-md bg-primary/20 border border-primary/50 block"></span>
                        <span className="text-foreground">Working Day</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-md bg-muted/50 border border-border block"></span>
                        <span className="text-muted-foreground">Weekly Off</span>
                      </div>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="bg-background border border-border rounded-xl p-3">
                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted-foreground mb-1 pb-1 border-b border-border">
                      <span className="text-destructive/80">Sun</span>
                      <span>Mon</span>
                      <span>Tue</span>
                      <span>Wed</span>
                      <span>Thu</span>
                      <span>Fri</span>
                      <span className="text-primary">Sat</span>
                    </div>

                    {/* Day cells */}
                    <div className="grid grid-cols-7 gap-1.5">
                      {/* Blank cells for start-of-month offset */}
                      {Array.from({ length: firstDayWeekday }).map((_, i) => (
                        <div
                          key={`empty-${i}`}
                          className="h-10 rounded-lg bg-muted/10 border border-transparent opacity-30"
                        />
                      ))}

                      {/* Actual month days */}
                      {previewDays.map(d => {
                        const isWorking = d.isWorkingDay;
                        const isWorkingSat = d.isSaturday && isWorking;
                        const satSuffix = d.saturdayOccurrence === 1 ? '1st Sat' : d.saturdayOccurrence === 2 ? '2nd Sat' : d.saturdayOccurrence === 3 ? '3rd Sat' : `${d.saturdayOccurrence}th Sat`;

                        return (
                          <div
                            key={d.dayNumber}
                            className={`min-h-[42px] p-1 rounded-lg border flex flex-col justify-between transition-colors ${
                              isWorking
                                ? 'bg-primary/20 text-primary border-primary/40 font-bold'
                                : 'bg-muted/20 text-muted-foreground/70 border-border/40 font-medium'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs leading-none">
                              <span className="font-bold">{d.dayNumber}</span>
                              {isWorkingSat && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-primary/30 text-primary font-bold">
                                  {satSuffix}
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] font-semibold text-right">
                              {isWorking ? (
                                <span className="text-primary">Work</span>
                              ) : (
                                <span className="text-muted-foreground/60">Off</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>
                      Dynamic rule: Working Saturdays are calculated automatically based on calendar dates for every month.
                    </span>
                  </div>
                </div>
              </div>

              {/* ACTIVE SHIFT CHECKBOX */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                  className="mr-2 rounded border-border bg-background text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="isActive" className="text-sm font-bold text-card-foreground">
                  Active Shift
                </label>
              </div>

              {/* MODAL FOOTER */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 min-h-[44px] text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 min-h-[44px] rounded-xl text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors"
                >
                  Save Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
