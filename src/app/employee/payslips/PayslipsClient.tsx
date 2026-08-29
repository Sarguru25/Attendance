'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { FileText, Download, DollarSign, Loader2, X } from 'lucide-react';
import { useCompany } from '@/components/CompanyProvider';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function PayslipsClient() {
  const { data, error, isLoading } = useSWR('/api/employee/payslips', fetcher);
  const { data: lettersData, isLoading: lettersLoading } = useSWR('/api/employee/letters', fetcher);
  
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const [selectedLetter, setSelectedLetter] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'payslips' | 'letters'>('payslips');
  const { activeCompany } = useCompany();

  const payslips = data?.payrolls || [];
  const letters = lettersData?.letters || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">View and download your payslips and official letters.</p>
        </div>
      </div>

      <div className="flex border-b border-border print:hidden gap-8">
        <button
          onClick={() => setActiveTab('payslips')}
          className={`pb-3 text-sm font-bold transition-colors relative ${
            activeTab === 'payslips' 
              ? 'text-primary' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Payslips
          {activeTab === 'payslips' && (
            <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-primary rounded-t-full"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('letters')}
          className={`pb-3 text-sm font-bold transition-colors relative ${
            activeTab === 'letters' 
              ? 'text-primary' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Letters
          {activeTab === 'letters' && (
            <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-primary rounded-t-full"></div>
          )}
        </button>
      </div>

      {activeTab === 'payslips' ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:hidden">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6 h-48 animate-pulse"></div>
          ))
        ) : payslips.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground bg-card rounded-2xl border border-border">
            No payslips available yet.
          </div>
        ) : (
          payslips.map((payslip: any) => {
            const date = new Date(payslip.year, payslip.month - 1);
            return (
              <div key={payslip._id} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:border-primary/50 transition-colors group flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-success/10 rounded-xl text-success group-hover:bg-success/20 transition-colors">
                      <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-card-foreground text-lg group-hover:text-primary transition-colors">{format(date, 'MMMM yyyy')}</h3>
                      <p className="text-xs text-muted-foreground">Generated: {format(new Date(payslip.generatedAt), 'MMM dd, yyyy')}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gross Salary</span>
                    <span className="text-card-foreground font-bold">₹{payslip.monthlySalary.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deductions</span>
                    <span className="text-destructive font-bold">-₹{payslip.deductions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t border-border pt-2 mt-2">
                    <span className="text-card-foreground">Net Payable</span>
                    <span className="text-success">₹{payslip.finalSalary.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPayslip(payslip)}
                  className="w-full flex items-center justify-center px-4 py-2 min-h-[44px] bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 transition-colors border border-border text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Full Payslip
                </button>
              </div>
            );
          })
        )}
      </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:hidden">
        {lettersLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6 h-48 animate-pulse"></div>
          ))
        ) : letters.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground bg-card rounded-2xl border border-border">
            No letters available yet.
          </div>
        ) : (
          letters.map((letter: any) => (
            <div key={letter._id} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:border-primary/50 transition-colors group flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:bg-primary/20 transition-colors">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-card-foreground text-lg group-hover:text-primary transition-colors">
                      {letter.templateId?.templateName || 'Official Letter'}
                    </h3>
                    <p className="text-xs text-muted-foreground">Generated: {format(new Date(letter.createdAt), 'MMM dd, yyyy')}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Category</span>
                  <span className="text-card-foreground font-bold">{letter.templateId?.category || 'General'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedLetter(letter)}
                  className="flex items-center justify-center px-3 py-2 min-h-[44px] bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 transition-colors border border-border text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Preview
                </button>
                <button
                  onClick={() => window.open(`/api/letters/${letter._id}/download`, '_blank')}
                  className="flex items-center justify-center px-3 py-2 min-h-[44px] bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      )}

      {/* Payslip Modal (Also used for printing) */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 overflow-y-auto print:absolute print:inset-0 print:bg-white print:text-black">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0 print:block print:p-0">
            <div className="fixed inset-0 transition-opacity bg-black/80 backdrop-blur-sm z-0 print:hidden" onClick={() => setSelectedPayslip(null)} />

            <div className="relative z-10 inline-block w-full max-w-3xl px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-card text-card-foreground rounded-2xl shadow-xl sm:my-8 sm:align-middle sm:p-8 print:shadow-none print:m-0 print:w-full print:max-w-none animate-in fade-in zoom-in-95 duration-200">

              <div className="flex justify-between items-center mb-8 print:hidden border-b border-border pb-4">
                <h3 className="text-xl font-bold">Payslip Preview</h3>
                <div className="flex gap-2">
                  <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Download className="w-4 h-4 mr-2" /> Print / PDF
                  </button>
                  <button onClick={() => setSelectedPayslip(null)} className="text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-accent transition-colors">
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
                      <td className="p-2">{(selectedPayslip.totalWorkingDays || 0) - (selectedPayslip.absentDays || 0)}</td>
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
            </div>
          </div>
        </div>
      )}

      {/* Letter Modal (Used for previewing/printing letter) */}
      {selectedLetter && (
        <div className="fixed inset-0 z-50 overflow-y-auto print:absolute print:inset-0 print:bg-white print:text-black">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0 print:block print:p-0">
            <div className="fixed inset-0 transition-opacity bg-black/80 backdrop-blur-sm z-0 print:hidden" onClick={() => setSelectedLetter(null)} />

            <div className="relative z-10 inline-block w-full max-w-3xl px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-card text-card-foreground rounded-2xl shadow-xl sm:my-8 sm:align-middle sm:p-8 print:shadow-none print:m-0 print:w-full print:max-w-none animate-in fade-in zoom-in-95 duration-200">

              <div className="flex justify-between items-center mb-6 print:hidden border-b border-border pb-4">
                <div>
                  <h3 className="text-xl font-bold text-card-foreground">{selectedLetter.templateId?.templateName || 'Official Letter'}</h3>
                  <p className="text-xs text-muted-foreground">Category: {selectedLetter.templateId?.category || 'General'}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => window.open(`/api/letters/${selectedLetter._id}/download`, '_blank')} 
                    className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-sm"
                  >
                    <Download className="w-4 h-4 mr-2" /> Download PDF
                  </button>
                  <button onClick={() => setSelectedLetter(null)} className="text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-accent transition-colors">
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* Document Preview Area */}
              <div className="space-y-4 text-black bg-white p-6 sm:p-10 rounded-xl overflow-x-auto border border-gray-200 shadow-sm min-h-[400px]">
                <div 
                  className="prose max-w-none text-black font-sans leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: selectedLetter.content || '<p class="text-gray-500">No content available.</p>' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

