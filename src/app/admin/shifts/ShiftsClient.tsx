'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Plus, Edit2, Trash2, X, Clock, CalendarDays } from 'lucide-react';

export default function ShiftsClient() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    shiftName: string;
    sessions: { order: number; startTime: string; endTime: string; graceTime: number }[];
    firstHalf: { startTime: string; endTime: string };
    secondHalf: { startTime: string; endTime: string };
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
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    isActive: true
  });

  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const fetchShifts = async () => {
    try {
      const res = await axios.get('/api/shifts');
      setShifts(res.data.shifts || []);
    } catch (err) {
      toast.error('Failed to load shifts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const handleOpenModal = (shift: any = null) => {
    if (shift) {
      setEditingId(shift._id);
      const sess = shift.sessions && shift.sessions.length > 0
        ? shift.sessions.map((s: any, idx: number) => ({
            order: s.order || idx + 1,
            startTime: s.startTime || '09:00',
            endTime: s.endTime || '13:00',
            graceTime: s.graceTime || 0
          }))
        : [
            { order: 1, startTime: shift.startTime || '09:00', endTime: '13:00', graceTime: shift.graceTime || 0 },
            { order: 2, startTime: '13:30', endTime: shift.endTime || '18:00', graceTime: 0 }
          ];

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
        workingDays: shift.workingDays || [],
        isActive: shift.isActive
      });
    } else {
      setEditingId(null);
      setFormData({
        shiftName: '',
        sessions: [
          { order: 1, startTime: '09:00', endTime: '13:00', graceTime: 15 },
          { order: 2, startTime: '13:30', endTime: '18:00', graceTime: 0 }
        ],
        firstHalf: { startTime: '09:00', endTime: '13:30' },
        secondHalf: { startTime: '13:30', endTime: '18:00' },
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        isActive: true
      });
    }
    setIsModalOpen(true);
  };

  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter(d => d !== day)
        : [...prev.workingDays, day]
    }));
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

  const updateSession = (index: number, field: string, value: any) => {
    const newSessions = [...formData.sessions];
    newSessions[index] = { ...newSessions[index], [field]: value };
    setFormData({ ...formData, sessions: newSessions });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.shiftName || formData.workingDays.length === 0) {
      toast.error('Please provide a name and at least one working day');
      return;
    }

    try {
      if (editingId) {
        await axios.put(`/api/shifts/${editingId}`, formData);
        toast.success('Shift updated successfully');
      } else {
        await axios.post('/api/shifts', formData);
        toast.success('Shift created successfully');
      }
      setIsModalOpen(false);
      fetchShifts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save shift');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) return;
    try {
      await axios.delete(`/api/shifts/${id}`);
      toast.success('Shift deleted');
      fetchShifts();
    } catch (err) {
      toast.error('Failed to delete shift');
    }
  };

  if (loading) return <div className="text-foreground font-bold text-center p-6">Loading shifts...</div>;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Shift Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure Check-in/out Punch Sessions and Half-Day Leave Split Timings</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 min-h-[44px] rounded-xl font-bold flex items-center gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" /> New Shift
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-x-auto shadow-sm">
        <table className="w-full text-left text-sm whitespace-nowrap min-w-[900px]">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="px-6 py-3 font-bold">Shift Name</th>
              <th className="px-6 py-3 font-bold">Punch Sessions</th>
              <th className="px-6 py-3 font-bold">Half-Day Split Timings</th>
              <th className="px-6 py-3 font-bold">Working Days</th>
              <th className="px-6 py-3 font-bold">Status</th>
              <th className="px-6 py-3 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shifts.map((s) => {
              const fh = s.firstHalf || { startTime: s.sessions?.[0]?.startTime || s.startTime || '09:00', endTime: s.sessions?.[0]?.endTime || '13:30' };
              const sh = s.secondHalf || { startTime: s.sessions?.[1]?.startTime || '13:30', endTime: s.sessions?.[s.sessions?.length - 1]?.endTime || s.endTime || '18:00' };

              return (
                <tr key={s._id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-card-foreground align-middle">{s.shiftName}</td>
                  <td className="px-6 py-4 text-card-foreground align-middle">
                    <div className="flex flex-col gap-1">
                      {s.sessions?.map((sess: any, idx: number) => (
                        <div key={idx} className="inline-flex items-center text-xs bg-muted/80 text-foreground p-1 px-2.5 rounded-md border border-border font-bold">
                          <Clock className="w-3 h-3 mr-1 text-primary" /> Session {sess.order}: {sess.startTime} - {sess.endTime} {sess.graceTime > 0 ? `(${sess.graceTime}m grace)` : ''}
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
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {s.workingDays?.map((d: string) => (
                        <span key={d} className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full border border-border font-bold">
                          {d.slice(0, 3)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <span className={`px-2 py-1 text-xs rounded-full font-bold ${s.isActive ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right align-middle">
                    <button onClick={() => handleOpenModal(s)} className="text-primary hover:text-primary/80 p-1"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(s._id)} className="text-destructive hover:text-destructive/80 p-1 ml-2"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              );
            })}
            {shifts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground font-bold">No shifts found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b border-border pb-3">
              <h2 className="text-xl font-bold text-card-foreground">{editingId ? 'Edit Shift Configuration' : 'Create New Shift'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-card-foreground mb-1">Shift Name</label>
                <input 
                  type="text" required
                  placeholder="e.g. Regular Day Shift"
                  value={formData.shiftName} onChange={e => setFormData({...formData, shiftName: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl min-h-[44px] p-2.5 text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>

              {/* SECTION 1: PUNCH CLOCK SESSIONS */}
              <div className="p-4 border border-border rounded-xl bg-muted/20 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="text-sm font-bold text-card-foreground flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-primary" /> Check-In / Check-Out Punch Sessions
                  </div>
                  <button
                    type="button"
                    onClick={addSession}
                    className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:bg-primary/90"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Punch Session
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.sessions.map((sess, idx) => (
                    <div key={idx} className="p-3 bg-background border border-border rounded-xl relative space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
                        <span>Session {sess.order}</span>
                        {formData.sessions.length > 1 && (
                          <button type="button" onClick={() => removeSession(idx)} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-card-foreground mb-1">Start Time</label>
                          <input 
                            type="time" required
                            value={sess.startTime} onChange={e => updateSession(idx, 'startTime', e.target.value)}
                            className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-card-foreground mb-1">End Time</label>
                          <input 
                            type="time" required
                            value={sess.endTime} onChange={e => updateSession(idx, 'endTime', e.target.value)}
                            className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-card-foreground mb-1">Grace (mins)</label>
                          <input 
                            type="number" min="0" required
                            value={sess.graceTime} onChange={e => updateSession(idx, 'graceTime', parseInt(e.target.value) || 0)}
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
                  {/* First Half */}
                  <div className="p-3 bg-background border border-border rounded-xl space-y-2">
                    <div className="text-xs font-bold text-primary">First Half Timing</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground mb-1">Start Time</label>
                        <input
                          type="time" required
                          value={formData.firstHalf.startTime}
                          onChange={e => setFormData({ ...formData, firstHalf: { ...formData.firstHalf, startTime: e.target.value } })}
                          className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground mb-1">End Time</label>
                        <input
                          type="time" required
                          value={formData.firstHalf.endTime}
                          onChange={e => setFormData({ ...formData, firstHalf: { ...formData.firstHalf, endTime: e.target.value } })}
                          className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Second Half */}
                  <div className="p-3 bg-background border border-border rounded-xl space-y-2">
                    <div className="text-xs font-bold text-card-foreground">Second Half Timing</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground mb-1">Start Time</label>
                        <input
                          type="time" required
                          value={formData.secondHalf.startTime}
                          onChange={e => setFormData({ ...formData, secondHalf: { ...formData.secondHalf, startTime: e.target.value } })}
                          className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground mb-1">End Time</label>
                        <input
                          type="time" required
                          value={formData.secondHalf.endTime}
                          onChange={e => setFormData({ ...formData, secondHalf: { ...formData.secondHalf, endTime: e.target.value } })}
                          className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-card-foreground mb-2">Working Days</label>
                <div className="flex flex-wrap gap-2">
                  {allDays.map(day => (
                    <button
                      key={day} type="button"
                      onClick={() => handleDayToggle(day)}
                      className={`px-3 min-h-[36px] rounded-full text-sm font-bold transition-colors ${
                        formData.workingDays.includes(day) 
                          ? 'bg-primary text-primary-foreground border border-primary' 
                          : 'bg-muted text-muted-foreground border border-border hover:border-muted-foreground'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center mt-2">
                <input 
                  type="checkbox" id="isActive"
                  checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})}
                  className="mr-2 rounded border-border bg-background text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="isActive" className="text-sm font-bold text-card-foreground">Active Shift</label>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 min-h-[44px] text-sm font-bold text-muted-foreground hover:text-foreground">Cancel</button>
                <button type="submit" className="px-4 py-2 min-h-[44px] rounded-xl text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground">Save Shift</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
