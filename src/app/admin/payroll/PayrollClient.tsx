'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { format, subMonths } from 'date-fns';
import { Search, Download, PlayCircle, FileText, Loader2, User as UserIcon, Mail, X, Trash2, Lock, Unlock } from 'lucide-react';
import * as ExcelJS from 'exceljs';
import { useCompany } from '@/components/CompanyProvider';
import { api } from '@/services/api';
import { formatDateDisplay } from '@/lib/salaryUtils';
import SalaryConfigurator from './SalaryConfigurator';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function PayrollClient() {
  const [activeTab, setActiveTab] = useState<'payroll' | 'salary'>('payroll');
  const [currentDate, setCurrentDate] = useState(new Date());
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  const { activeCompany } = useCompany();

  const { data, error, isLoading, mutate } = useSWR(`/api/admin/payroll?month=${month}&year=${year}`, fetcher);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [downloadingPayslip, setDownloadingPayslip] = useState<string | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  const isMonthLocked = (data?.payrolls || []).length > 0 && (data?.payrolls || []).every((p: any) => p.isLocked);

  const handleToggleLock = async () => {
    if (!payrolls.length) return;
    const targetLockState = !isMonthLocked;
    const actionName = targetLockState ? 'Lock' : 'Unlock';
    if (!confirm(`Are you sure you want to ${actionName.toLowerCase()} payroll for ${format(currentDate, 'MMMM yyyy')}?`)) return;

    setIsLocking(true);
    try {
      const res = await api('/api/admin/payroll/lock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year, isLocked: targetLockState })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to ${actionName.toLowerCase()} payroll`);
      }
      mutate();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLocking(false);
    }
  };

  const handleDeleteMonth = async () => {
    if (!payrolls.length) return;
    const monthName = format(currentDate, 'MMMM yyyy');
    if (!confirm(`Are you sure you want to delete ALL payroll records for ${monthName}? This action cannot be undone.`)) return;

    setIsDeleting(true);
    try {
      const res = await api(`/api/admin/payroll?month=${month}&year=${year}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete payroll');
      }
      const result = await res.json();
      alert(`Successfully deleted ${result.count} payroll record(s) for ${monthName}.`);
      mutate();
    } catch (error: any) {
      alert(`Error deleting payroll: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSingle = async (payrollId: string, employeeName: string) => {
    if (!confirm(`Are you sure you want to delete the payroll record for ${employeeName}?`)) return;

    setDeletingId(payrollId);
    try {
      const res = await api(`/api/admin/payroll?id=${payrollId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete payroll record');
      }
      mutate();
    } catch (error: any) {
      alert(`Error deleting record: ${error.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPayslip = async (payrollId: string) => {
    // We are now using the modal to view and print the payslip, but if they still want the direct PDF download we can keep it.
    // However, since we added the modal, we will change the button to open the modal instead.
  };

  const handleSendEmail = async (payrollId: string) => {
    setSendingEmail(payrollId);
    try {
      const res = await api('/api/admin/payroll/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payrollId })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send email');
      }
      alert('Email sent successfully!');
    } catch (error: any) {
      alert(`Error sending email: ${error.message}`);
    } finally {
      setSendingEmail(null);
    }
  };

  const handleSendBulkEmail = async () => {
    if (!payrolls.length) return;
    if (!confirm(`Are you sure you want to send payslips to all ${payrolls.length} employees?`)) return;

    setIsSendingBulk(true);
    let successCount = 0;
    let errorMessages: string[] = [];

    for (let i = 0; i < payrolls.length; i++) {
      setBulkProgress({ current: i + 1, total: payrolls.length });
      try {
        const res = await api('/api/admin/payroll/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payrollId: payrolls[i]._id })
        });
        if (res.ok) {
          successCount++;
        } else {
          const data = await res.json().catch(() => ({}));
          const errMsg = data.error || 'Server returned error';
          console.error(`Failed to send email to ${payrolls[i].userId?.name}:`, errMsg);
          errorMessages.push(`${payrolls[i].userId?.name}: ${errMsg}`);
        }
      } catch (error: any) {
        console.error('Failed to send email to', payrolls[i].userId?.name, error);
        errorMessages.push(`${payrolls[i].userId?.name}: Network error`);
      }
    }

    let resultMsg = `Successfully sent ${successCount} out of ${payrolls.length} emails.`;
    if (errorMessages.length > 0) {
      resultMsg += `\n\nFailed (${errorMessages.length}):\n${errorMessages.slice(0, 5).join('\n')}`;
      if (errorMessages.length > 5) resultMsg += `\n...and ${errorMessages.length - 5} more.`;
    }

    alert(resultMsg);
    setIsSendingBulk(false);
    setBulkProgress({ current: 0, total: 0 });
  };

  const payrolls = data?.payrolls || [];

  const filteredPayrolls = payrolls.filter((p: any) =>
    p.userId?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.userId?.employeeId?.toLowerCase().includes(search.toLowerCase())
  );

  const handleGenerate = async () => {
    if (!confirm(`Generate payroll for ${format(currentDate, 'MMMM yyyy')}?`)) return;
    setIsGenerating(true);
    try {
      const res = await api('/api/admin/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year })
      });
      if (!res.ok) throw new Error('Failed to generate');
      const result = await res.json();
      alert(`Successfully generated payroll for ${result.count} employees.`);
      mutate();
    } catch (err) {
      alert('Error generating payroll');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!payrolls.length) return;
    const workbook = new ExcelJS.Workbook();
    const monthYearStr = format(currentDate, 'MMMM yyyy');
    const worksheet = workbook.addWorksheet(`Payroll_${format(currentDate, 'MMM_yyyy')}`);

    const companyTitle = (activeCompany?.companyName || 'TRUFLOW SOLUTIONS PRIVATE LIMITED').toUpperCase();

    // Row 1: Company Title Banner across Columns A:L
    worksheet.mergeCells('A1:L1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = companyTitle;
    titleCell.font = { name: 'Calibri', size: 14, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FCE4D6' }
    };
    titleCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    worksheet.getRow(1).height = 32;

    // Row 2: Headers
    const headers = [
      'S.No',
      'Employee Name',
      'Basic',
      'HRA',
      'Dearness Allowance',
      'Basic+ DA',
      'ESI Deductions',
      'Rental Deduction',
      'Loan Deductions',
      'Other deductions',
      'Gross Monthly',
      monthYearStr
    ];

    const headerRow = worksheet.getRow(2);
    headerRow.values = headers;
    headerRow.height = 28;

    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'F2F2F2' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Column widths
    worksheet.getColumn(1).width = 8;   // S.No
    worksheet.getColumn(2).width = 25;  // Employee Name
    worksheet.getColumn(3).width = 15;  // Basic
    worksheet.getColumn(4).width = 15;  // HRA
    worksheet.getColumn(5).width = 20;  // Dearness Allowance
    worksheet.getColumn(6).width = 18;  // Basic+ DA
    worksheet.getColumn(7).width = 16;  // ESI Deductions
    worksheet.getColumn(8).width = 18;  // Rental Deduction
    worksheet.getColumn(9).width = 18;  // Loan Deductions
    worksheet.getColumn(10).width = 18; // Other deductions
    worksheet.getColumn(11).width = 18; // Gross Monthly
    worksheet.getColumn(12).width = 16; // Month Year

    // Data Rows
    payrolls.forEach((p: any, idx: number) => {
      const monthlySalary = p.monthlySalary || 0;
      const basic = p.basicSalary ?? Math.round(monthlySalary * 0.5);
      const hra = p.hra ?? Math.round(monthlySalary * 0.15);
      const da = p.da ?? (monthlySalary - basic - hra);
      const basicPlusDa = p.basicPlusDa ?? (basic + da);

      const esi = p.esiDeduction ?? p.salaryDeductionsSnapshot?.esi ?? 0;
      const rental = p.rentalDeduction ?? p.salaryDeductionsSnapshot?.hra ?? 0;
      const loan = p.loanDeduction ?? p.salaryDeductionsSnapshot?.loan ?? 0;
      const otherDeductions = p.otherDeductions ?? Math.max(0, (p.deductionAmount || 0) - esi - rental - loan);
      const grossMonthly = p.monthlySalary ?? (basic + hra + da);
      const netMonthSalary = p.netSalary ?? p.finalSalary ?? 0;

      const dataRow = worksheet.addRow([
        idx + 1,
        p.userId?.name || 'N/A',
        basic,
        hra,
        da,
        basicPlusDa,
        esi,
        rental,
        loan,
        otherDeductions,
        grossMonthly,
        netMonthSalary
      ]);

      dataRow.height = 22;

      dataRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

        if (colNumber === 1) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNumber === 2) {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0';
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Payroll_${format(currentDate, 'MMM_yyyy')}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const months = Array.from({ length: 6 }).map((_, i) => subMonths(new Date(), i));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Payroll Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage salary, deductions, and payslips.</p>
        </div>
        <div className="flex bg-muted p-1 rounded-xl w-max border border-border">
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'payroll' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Payroll Run
          </button>
          <button
            onClick={() => setActiveTab('salary')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'salary' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Salary Configuration
          </button>
        </div>

        {activeTab === 'payroll' && (
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              onClick={handleDeleteMonth}
              disabled={isMonthLocked || isDeleting || isGenerating || isSendingBulk || !payrolls.length}
              className="w-full sm:w-auto flex justify-center items-center px-4 py-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl min-h-[44px] hover:bg-destructive/20 transition-colors shadow-sm font-bold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={isMonthLocked ? "Unlock payroll first to delete" : "Delete all payroll records for this month"}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Month
            </button>
            <button
              onClick={handleSendBulkEmail}
              disabled={isSendingBulk || isGenerating || isDeleting || !payrolls.length}
              className="w-full sm:w-auto flex justify-center items-center px-4 py-2 bg-success text-success-foreground rounded-xl min-h-[44px] hover:bg-success/90 transition-colors shadow-sm font-bold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {isSendingBulk ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              {isSendingBulk ? `Sending (${bulkProgress.current}/${bulkProgress.total})` : 'Send All'}
            </button>
            <button
              onClick={handleExport}
              disabled={isSendingBulk || isGenerating || isDeleting || !payrolls.length}
              className="w-full sm:w-auto flex justify-center items-center px-4 py-2 bg-secondary border border-border text-secondary-foreground rounded-xl min-h-[44px] hover:bg-secondary/80 transition-colors shadow-sm font-bold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
            <button
              onClick={handleGenerate}
              disabled={isMonthLocked || isGenerating || isSendingBulk || isDeleting}
              className="w-full sm:w-auto flex justify-center items-center px-4 py-2 bg-primary text-primary-foreground rounded-xl min-h-[44px] hover:bg-primary/90 transition-colors shadow-sm font-bold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              title={isMonthLocked ? "Unlock payroll first to regenerate" : "Generate payroll"}
            >
              {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
              Generate
            </button>
          </div>
        )}
      </div>

      {activeTab === 'salary' ? (
        <SalaryConfigurator />
      ) : (
        <>
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col print:hidden">
            <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative max-w-md w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-border rounded-xl min-h-[44px] leading-5 bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-colors font-bold"
                  placeholder="Search employee..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {payrolls.length > 0 && (
                  <button
                    onClick={handleToggleLock}
                    disabled={isLocking || isGenerating || isDeleting}
                    className={`flex items-center justify-center gap-2 px-3.5 py-2 border rounded-xl min-h-[44px] text-xs font-bold transition-all shadow-sm shrink-0 disabled:opacity-50 ${
                      isMonthLocked 
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20' 
                        : 'bg-background border-border text-foreground hover:bg-muted'
                    }`}
                    title={isMonthLocked ? "Unlock payroll for this month" : "Lock payroll for this month to prevent changes"}
                  >
                    {isLocking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isMonthLocked ? (
                      <Lock className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Unlock className="h-4 w-4" />
                    )}
                    <span>{isMonthLocked ? 'Payroll Locked' : 'Lock Payroll'}</span>
                  </button>
                )}

                <select
                  className="w-full sm:w-auto block pl-3 pr-10 py-2 min-h-[44px] text-base border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm rounded-xl transition-colors font-bold cursor-pointer"
                  onChange={(e) => {
                    const [y, m] = e.target.value.split('-').map(Number);
                    setCurrentDate(new Date(y, m - 1, 1));
                  }}
                  value={`${year}-${month}`}
                >
                  {months.map((m, i) => {
                    const optionVal = `${m.getFullYear()}-${m.getMonth() + 1}`;
                    return (
                      <option key={i} value={optionVal}>{format(m, 'MMMM yyyy')}</option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/30">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Employee</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Shift</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Days (W/P/A/L/WO)</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Gross Salary</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Deductions</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Net Payable</th>
                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {isLoading ? (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-muted-foreground font-bold">Loading...</td></tr>
                  ) : filteredPayrolls.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground font-bold">
                        No payroll data for this month. Click "Generate Payroll" to calculate.
                      </td>
                    </tr>
                  ) : (
                    filteredPayrolls.map((payroll: any) => {
                      const user = payroll.userId;
                      return (
                        <tr key={payroll._id.toString()} className="hover:bg-muted/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 bg-muted rounded-full flex items-center justify-center overflow-hidden border border-border">
                                {user?.profileImage ? (
                                  <img src={user.profileImage} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <UserIcon className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-bold text-card-foreground">{user?.name || 'Unknown'}</div>
                                <div className="text-xs text-muted-foreground font-bold">{user?.employeeId || '-'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 bg-muted text-muted-foreground font-bold text-xs rounded-lg block w-max mb-1 border border-border">
                              {user?.shiftId?.shiftName || 'N/A'}
                            </span>
                            <div className="text-[10px] text-muted-foreground font-bold">
                              {user?.shiftId?.workingDays?.map((d: string) => d.slice(0, 3)).join('-') || 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-xs space-y-1 font-bold">
                              <div className="text-muted-foreground">Total Working: <span className="text-foreground">{payroll.totalWorkingDays}</span></div>
                              <div className="text-success">Present: {payroll.presentDays}</div>
                              <div className="text-destructive">Absent: {payroll.absentDays}</div>
                              <div className="text-warning">Leave: {payroll.leaveDays || 0}</div>
                              <div className="text-primary">Weekly Off: {payroll.weeklyOffDays || 0}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-card-foreground">
                            <div>₹{(payroll.grossSalary || payroll.monthlySalary).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            {payroll.salaryTimelineEffectiveFrom && (
                              <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                                Timeline: {formatDateDisplay(payroll.salaryTimelineEffectiveFrom)}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-destructive font-bold">
                            -₹{(payroll.deductionAmount ?? payroll.deductions).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-success">
                            ₹{(payroll.netSalary || payroll.finalSalary).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleSendEmail(payroll._id)}
                                disabled={sendingEmail === payroll._id || isSendingBulk || deletingId === payroll._id}
                                className="text-success hover:text-success/80 transition-colors bg-success/10 px-4 py-2 min-h-[44px] rounded-xl border border-success/20 flex items-center disabled:opacity-50"
                              >
                                {sendingEmail === payroll._id ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Mail className="h-4 w-4 mr-1.5" />}
                                Email
                              </button>
                              <button
                                onClick={() => setSelectedPayslip(payroll)}
                                className="text-primary hover:text-primary/80 transition-colors bg-primary/10 px-4 py-2 min-h-[44px] rounded-xl border border-primary/20 flex items-center"
                              >
                                <FileText className="h-4 w-4 mr-1.5" />
                                Payslip
                              </button>
                              <button
                                onClick={() => handleDeleteSingle(payroll._id, user?.name || 'employee')}
                                disabled={isMonthLocked || deletingId === payroll._id || isSendingBulk || isDeleting}
                                className="text-destructive hover:text-destructive/80 transition-colors bg-destructive/10 px-3 py-2 min-h-[44px] rounded-xl border border-destructive/20 flex items-center disabled:opacity-50"
                                title={isMonthLocked ? "Unlock payroll first to delete" : "Delete this payroll record"}
                              >
                                {deletingId === payroll._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payslip Modal (Also used for printing) */}
          {selectedPayslip && (
            <div className="fixed inset-0 z-50 overflow-y-auto print:absolute print:inset-0 print:bg-white print:text-black">
              <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0 print:block print:p-0">
                <div className="fixed inset-0 transition-opacity bg-black/80 backdrop-blur-sm z-0 print:hidden" onClick={() => setSelectedPayslip(null)} />

                <div className="relative z-10 inline-block w-full max-w-3xl px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-card text-card-foreground rounded-2xl shadow-xl sm:my-8 sm:align-middle sm:p-8 print:shadow-none print:m-0 print:w-full print:max-w-none print:bg-white print:text-black border border-border print:border-none">

                  <div className="flex justify-between items-center mb-8 print:hidden border-b border-border pb-4">
                    <h3 className="text-xl font-bold text-card-foreground">Payslip Preview</h3>
                    <div className="flex gap-2">
                      <button onClick={handlePrint} className="flex items-center px-4 py-2 min-h-[44px] bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Download className="w-4 h-4 mr-2" /> Print / PDF
                      </button>
                      <button onClick={() => setSelectedPayslip(null)} className="text-muted-foreground hover:text-foreground font-bold p-2">
                        <X className="h-6 w-6" />
                      </button>
                    </div>
                  </div>

                  {/* Printable Area */}
                  <div className="space-y-4 text-black bg-white p-4 sm:p-8 rounded-lg overflow-x-auto">
                    {/* Header */}
                    <div className="flex justify-center items-center relative mb-6">
                      <h1 className="text-xl font-bold uppercase tracking-wider">Pay Slip</h1>
                      <div className="absolute right-0 text-3xl font-bold text-[#d32f2f] uppercase tracking-wider">
                        {activeCompany?.companyName || 'COMPANY NAME'}
                      </div>
                    </div>

                    {/* Table 1 */}
                    <table className="w-full min-w-[600px] border-2 border-black text-sm mb-4">
                      <tbody>
                        <tr className="border-b border-black">
                          <td className="p-2 border-r border-black w-1/4">Employee Name</td>
                          <td className="p-2 border-r border-black w-1/4">{selectedPayslip.userId?.name || '-'}</td>
                          <td className="p-2 border-r border-black w-1/4">Month</td>
                          <td className="p-2 w-1/4">{format(new Date(selectedPayslip.year, selectedPayslip.month - 1), 'MMM yyyy')}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="p-2 border-r border-black">Designation</td>
                          <td className="p-2 border-r border-black">{selectedPayslip.userId?.designation || '-'}</td>
                          <td className="p-2 border-r border-black">Total Working Days</td>
                          <td className="p-2">{selectedPayslip.totalWorkingDays || '-'}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="p-2 border-r border-black">Date of Joining</td>
                          <td className="p-2 border-r border-black">{selectedPayslip.userId?.joiningDate ? format(new Date(selectedPayslip.userId.joiningDate), 'dd.MM.yyyy') : '-'}</td>
                          <td className="p-2 border-r border-black">Un-Paid Leave Taken</td>
                          <td className="p-2">{selectedPayslip.absentDays || 0}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="p-2 border-r border-black">Job Location</td>
                          <td className="p-2 border-r border-black">{selectedPayslip.userId?.location || selectedPayslip.userId?.address || 'Coimbatore'}</td>
                          <td className="p-2 border-r border-black">Days Paid</td>
                          <td className="p-2">{selectedPayslip.paidDays || 0}</td>
                        </tr>
                        <tr>
                          <td className="p-2 border-r border-black">Bank Name</td>
                          <td className="p-2 border-r border-black">{selectedPayslip.userId?.bankName || '-'}</td>
                          <td className="p-2 border-r border-black">A/c Number</td>
                          <td className="p-2">{selectedPayslip.userId?.accountNumber || '-'}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Table 2: Leave */}
                    <table className="w-full min-w-[600px] border-2 border-black text-sm text-center mb-4">
                      <thead>
                        <tr className="bg-gray-50 border-b border-black">
                          <th className="p-2 border-r border-black font-normal w-1/4">Leave Record</th>
                          <th className="p-2 border-r border-black font-normal w-1/4">Total</th>
                          <th className="p-2 border-r border-black font-normal w-1/4">Taken</th>
                          <th className="p-2 font-normal w-1/4">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-black">
                          <td className="p-2 border-r border-black">Casual Leave</td>
                          <td className="p-2 border-r border-black">{selectedPayslip.userId?.leaveBalance?.casualLeave?.total || 0}</td>
                          <td className="p-2 border-r border-black bg-gray-100">{selectedPayslip.userId?.leaveBalance?.casualLeave?.taken || 0}</td>
                          <td className="p-2">{selectedPayslip.userId?.leaveBalance?.casualLeave?.available || 0}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="p-2 border-r border-black">Sick Leave</td>
                          <td className="p-2 border-r border-black">{selectedPayslip.userId?.leaveBalance?.sickLeave?.total || 0}</td>
                          <td className="p-2 border-r border-black bg-gray-100">{selectedPayslip.userId?.leaveBalance?.sickLeave?.taken || 0}</td>
                          <td className="p-2">{selectedPayslip.userId?.leaveBalance?.sickLeave?.available || 0}</td>
                        </tr>
                        <tr>
                          <td className="p-2 border-r border-black">Restricted Holiday</td>
                          <td className="p-2 border-r border-black">{selectedPayslip.userId?.leaveBalance?.restrictedLeave?.total || 0}</td>
                          <td className="p-2 border-r border-black bg-gray-100">{selectedPayslip.userId?.leaveBalance?.restrictedLeave?.taken || 0}</td>
                          <td className="p-2">{selectedPayslip.userId?.leaveBalance?.restrictedLeave?.available || 0}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Table 3: Salary */}
                    <table className="w-full min-w-[600px] border-2 border-black text-sm mb-4">
                      <thead>
                        <tr className="border-b border-black text-center">
                          <th colSpan={2} className="p-2 border-r border-black font-bold uppercase w-1/2">SALARY</th>
                          <th colSpan={2} className="p-2 font-bold uppercase w-1/2">DEDUCTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const monthlySalary = selectedPayslip.monthlySalary || 0;
                          const basicSalary = monthlySalary * 0.5;
                          const hraAllowance = monthlySalary * 0.2;
                          const otherAllowances = monthlySalary * 0.3;

                          const totalDeductions = selectedPayslip.deductionAmount || selectedPayslip.deductions || 0;
                          const esi = selectedPayslip.salaryDeductionsSnapshot?.esi || 0;
                          const rentalDeduction = selectedPayslip.userId?.salaryDeductions?.hra?.amount || selectedPayslip.salaryDeductionsSnapshot?.hra || 0;
                          const loan = selectedPayslip.salaryDeductionsSnapshot?.loan || 0;

                          // Loss of Pay is what's left of totalDeductions after ESI, Rental, and Loan
                          const lossOfPay = Math.max(0, totalDeductions - esi - rentalDeduction - loan);
                          const otherDeductions = lossOfPay + loan;

                          const netPayable = monthlySalary - totalDeductions;

                          return (
                            <>
                              <tr className="border-b border-black">
                                <td className="p-2 border-r border-black w-1/4">Basic Salary</td>
                                <td className="p-2 border-r border-black w-1/4 text-right">₹{basicSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td className="p-2 border-r border-black w-1/4">TDS</td>
                                <td className="p-2 w-1/4 text-right">₹0.00</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-2 border-r border-black">HRA</td>
                                <td className="p-2 border-r border-black text-right">₹{hraAllowance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td className="p-2 border-r border-black">ESI</td>
                                <td className="p-2 text-right">₹{esi.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-2 border-r border-black">Other Allowances</td>
                                <td className="p-2 border-r border-black text-right">₹{otherAllowances.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td className="p-2 border-r border-black">Rental Deduction</td>
                                <td className="p-2 text-right">₹{rentalDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-2 border-r border-black">Bonus</td>
                                <td className="p-2 border-r border-black text-right">₹0.00</td>
                                <td className="p-2 border-r border-black">Other Deduction</td>
                                <td className="p-2 text-right">₹{otherDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-2 border-r border-black">Gross Total</td>
                                <td className="p-2 border-r border-black text-right">₹{monthlySalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td className="p-2 border-r border-black">Total Deductions</td>
                                <td className="p-2 text-right">₹{totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              </tr>
                              <tr>
                                <td colSpan={3} className="p-2 border-r border-black text-right font-bold text-base">Net Payable</td>
                                <td className="p-2 text-right font-bold text-base">₹{netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              </tr>
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {selectedPayslip.salaryTimelineEffectiveFrom && (
                    <div className="text-[11px] text-gray-500 italic mt-3 text-center print:text-black">
                      * Salary determined from timeline effective {formatDateDisplay(selectedPayslip.salaryTimelineEffectiveFrom)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
