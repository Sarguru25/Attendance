'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
  format, startOfYear, endOfYear, eachMonthOfInterval, 
  startOfMonth, endOfMonth, eachDayOfInterval, getDay, 
  isSameDay, isSameMonth, addYears, subYears, parseISO
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, Loader2, Download, Upload } from 'lucide-react';
import * as ExcelJS from 'exceljs';
import { api } from '@/services/api';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const HOLIDAY_COLORS = {
  public: 'bg-destructive/90',
  restricted: 'bg-warning/90',
  company: 'bg-primary/90',
  'half-day': 'bg-purple-500/90',
  'working-day': 'bg-success/90'
};

const HOLIDAY_LABELS = {
  public: 'Public Holiday',
  restricted: 'Restricted Holiday',
  company: 'Company Holiday',
  'half-day': 'Half-Day',
  'working-day': 'Working Weekend'
};

export default function CalendarClient() {
  const [currentYearDate, setCurrentYearDate] = useState(new Date());
  const year = currentYearDate.getFullYear();
  
  const { data, error, isLoading, mutate } = useSWR(`/api/admin/holidays?year=${year}`, fetcher);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<any>(null);
  const [formData, setFormData] = useState({
    holidayName: '',
    holidayType: 'public',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    isPaid: true,
    isRecurring: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const holidays = data?.holidays || [];

  const getHolidayForDate = (date: Date) => {
    return holidays.find((h: any) => isSameDay(new Date(h.date), date));
  };

  const openModal = (holiday: any = null, date: Date | null = null) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setFormData({
        holidayName: holiday.holidayName,
        holidayType: holiday.holidayType,
        description: holiday.description || '',
        date: format(new Date(holiday.date), 'yyyy-MM-dd'),
        isPaid: holiday.isPaid,
        isRecurring: holiday.isRecurring,
      });
    } else {
      setEditingHoliday(null);
      setFormData({
        holidayName: '',
        holidayType: 'public',
        description: '',
        date: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        isPaid: true,
        isRecurring: false,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const url = editingHoliday ? `/api/admin/holidays/${editingHoliday._id}` : '/api/admin/holidays';
      const method = editingHoliday ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) throw new Error('Failed to save');
      
      await mutate();
      setIsModalOpen(false);
    } catch (error) {
      alert('Error saving holiday');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingHoliday || !confirm('Delete this holiday?')) return;
    setIsSaving(true);
    try {
      const response = await api(`/api/admin/holidays/${editingHoliday._id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete');
      await mutate();
      setIsModalOpen(false);
    } catch (error) {
      alert('Error deleting holiday');
    } finally {
      setIsSaving(false);
    }
  };

  // Generate Year Data
  const months = eachMonthOfInterval({
    start: startOfYear(currentYearDate),
    end: endOfYear(currentYearDate)
  });

  const renderMonth = (monthDate: Date) => {
    const daysInMonth = eachDayOfInterval({
      start: startOfMonth(monthDate),
      end: endOfMonth(monthDate)
    });
    
    const startingDayOfWeek = getDay(startOfMonth(monthDate));
    const blanks = Array.from({ length: startingDayOfWeek });

    return (
      <div key={monthDate.toISOString()} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
        <h3 className="font-bold text-card-foreground mb-3 text-center">{format(monthDate, 'MMMM')}</h3>
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="text-xs font-bold text-muted-foreground">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {blanks.map((_, i) => (
            <div key={`blank-${i}`} className="h-8 w-8" />
          ))}
          {daysInMonth.map(date => {
            const holiday = getHolidayForDate(date);
            const isToday = isSameDay(date, new Date());
            
            return (
              <div 
                key={date.toISOString()}
                onClick={() => openModal(holiday, date)}
                title={holiday ? `${holiday.holidayName} (${HOLIDAY_LABELS[holiday.holidayType as keyof typeof HOLIDAY_LABELS]})` : ''}
                className={`
                  h-8 w-8 mx-auto flex items-center justify-center text-xs rounded-full cursor-pointer transition-colors
                  ${holiday ? HOLIDAY_COLORS[holiday.holidayType as keyof typeof HOLIDAY_COLORS] + ' text-white font-bold shadow-sm' 
                    : isToday ? 'bg-primary/20 text-primary font-bold border border-primary' 
                    : 'text-card-foreground font-bold hover:bg-muted'}
                `}
              >
                {format(date, 'd')}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleExport = async () => {
    if (!holidays.length) return;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Holidays');
    
    worksheet.columns = [
      { header: 'Holiday Name', key: 'name', width: 30 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Type', key: 'type', width: 20 },
      { header: 'Is Paid', key: 'isPaid', width: 10 },
      { header: 'Description', key: 'desc', width: 40 },
    ];

    holidays.forEach((h: any) => {
      worksheet.addRow({
        name: h.holidayName,
        date: format(new Date(h.date), 'yyyy-MM-dd'),
        type: h.holidayType,
        isPaid: h.isPaid ? 'Yes' : 'No',
        desc: h.description || '',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Holiday_Calendar_${year}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Calendar Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage public and company holidays.</p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
          <button onClick={handleExport} className="w-full sm:w-auto justify-center flex items-center px-4 py-2 bg-secondary border border-border text-secondary-foreground min-h-[44px] rounded-xl hover:bg-secondary/80 transition-colors shadow-sm text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          <button onClick={() => openModal()} className="w-full sm:w-auto justify-center flex items-center px-4 py-2 bg-primary text-primary-foreground min-h-[44px] rounded-xl hover:bg-primary/90 transition-colors shadow-sm text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <Plus className="h-4 w-4 mr-2" />
            Add Holiday
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentYearDate(subYears(currentYearDate, 1))} className="p-2 text-muted-foreground hover:text-foreground bg-muted rounded-full transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-xl font-bold text-card-foreground flex items-center">
            <CalendarIcon className="h-5 w-5 mr-2 text-primary" />
            {year}
          </h2>
          <button onClick={() => setCurrentYearDate(addYears(currentYearDate, 1))} className="p-2 text-muted-foreground hover:text-foreground bg-muted rounded-full transition-colors">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(HOLIDAY_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center">
              <span className={`h-3 w-3 rounded-full mr-1.5 ${HOLIDAY_COLORS[key as keyof typeof HOLIDAY_COLORS]}`}></span>
              <span className="text-card-foreground font-bold">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({length: 12}).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 h-64 animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {months.map(renderMonth)}
        </div>
      )}

      {/* Holiday Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-black/80 backdrop-blur-sm z-0" onClick={() => setIsModalOpen(false)} />
            <div className="relative z-10 inline-block w-full max-w-md px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-card border border-border rounded-2xl shadow-xl sm:my-8 sm:align-middle sm:p-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-5 border-b border-border pb-4">
                <h3 className="text-lg font-bold text-card-foreground">{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-card-foreground mb-1.5">Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-card-foreground mb-1.5">Holiday Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. New Year's Day"
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    value={formData.holidayName}
                    onChange={(e) => setFormData({...formData, holidayName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-card-foreground mb-1.5">Type</label>
                  <select
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    value={formData.holidayType}
                    onChange={(e) => setFormData({...formData, holidayType: e.target.value})}
                  >
                    {Object.entries(HOLIDAY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-card-foreground mb-1.5">Description (Optional)</label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  ></textarea>
                </div>
                
                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center text-sm font-bold text-card-foreground">
                    <input
                      type="checkbox"
                      className="mr-2 h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary"
                      checked={formData.isPaid}
                      onChange={(e) => setFormData({...formData, isPaid: e.target.checked})}
                    />
                    Is Paid Holiday
                  </label>
                  <label className="flex items-center text-sm font-bold text-card-foreground">
                    <input
                      type="checkbox"
                      className="mr-2 h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary"
                      checked={formData.isRecurring}
                      onChange={(e) => setFormData({...formData, isRecurring: e.target.checked})}
                    />
                    Recurs Yearly
                  </label>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row-reverse gap-3 w-full border-t border-border pt-5">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 sm:flex-none inline-flex justify-center rounded-xl min-h-[44px] border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-50 sm:text-sm"
                  >
                    {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : 'Save'}
                  </button>
                  {editingHoliday && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isSaving}
                      className="flex-1 sm:flex-none inline-flex justify-center rounded-xl min-h-[44px] border border-destructive/20 shadow-sm px-4 py-2 bg-destructive/10 text-base font-bold text-destructive hover:bg-destructive/20 focus:outline-none disabled:opacity-50 sm:text-sm"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 sm:flex-none inline-flex justify-center rounded-xl min-h-[44px] border border-border shadow-sm px-4 py-2 bg-secondary text-base font-bold text-secondary-foreground hover:bg-secondary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:text-sm"
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
