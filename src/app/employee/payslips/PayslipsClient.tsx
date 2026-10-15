'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { FileText, Download, DollarSign, Loader2, X, Printer } from 'lucide-react';
import { useCompany } from '@/components/CompanyProvider';
import { resolvePayslipBreakdown } from '@/lib/salaryUtils';

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
        <div className="fixed inset-0 z-50 overflow-y-auto print:static print:inset-auto print:overflow-visible print:bg-white print:text-black">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0 print:block print:p-0 print:min-h-0">
            <div className="fixed inset-0 transition-opacity bg-black/80 backdrop-blur-sm z-0 print:hidden" onClick={() => setSelectedPayslip(null)} />

            <div className="relative z-10 inline-block w-full max-w-3xl px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-card text-card-foreground rounded-2xl shadow-xl sm:my-8 sm:align-middle sm:p-8 print:shadow-none print:m-0 print:w-full print:max-w-none print:border-none print:bg-white print:p-0 print:overflow-visible animate-in fade-in zoom-in-95 duration-200">

              <div className="flex justify-between items-center mb-8 print:hidden border-b border-border pb-4">
                <h3 className="text-xl font-bold">Payslip Preview</h3>
                <div className="flex gap-2">
                  <a
                    href={`/api/payroll/payslip?id=${selectedPayslip._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-bold text-sm"
                  >
                    <Download className="w-4 h-4 mr-2" /> Download PDF
                  </a>
                  <button
                    onClick={handlePrint}
                    className="flex items-center px-4 py-2 bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 font-bold border border-border text-sm"
                  >
                    <Printer className="w-4 h-4 mr-2" /> Print
                  </button>
                  <button onClick={() => setSelectedPayslip(null)} className="text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-accent transition-colors">
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* Printable Area matching Reference Image */}
              {(() => {
                const selectedCompany = (selectedPayslip?.companyId && typeof selectedPayslip.companyId === 'object')
                  ? selectedPayslip.companyId
                  : (selectedPayslip?.userId?.companyId && typeof selectedPayslip.userId?.companyId === 'object'
                    ? selectedPayslip.userId.companyId
                    : activeCompany);

                const companyName = selectedCompany?.companyName || 'Truflow Solutions Private Limited';
                const companyAddress = selectedCompany?.address || 'S.F.No.617/2H2, Vadakku Thottam, L&T Road, Malumichampatti, Coimbatore, Tamil Nadu-641050';
                const companyLogo = selectedCompany?.logo || '/logo/truflow.png';

                const monthDate = new Date(selectedPayslip.year, selectedPayslip.month - 1);
                const monthName = format(monthDate, 'MMMM yyyy');

                const {
                  daysInMonth,
                  basicSalary,
                  hraAllowance,
                  da,
                  bonus,
                  grossEarnings,
                  esi,
                  tds,
                  loan,
                  rental,
                  otherDeductions,
                  lossOfPay,
                  totalDeductions,
                  netPayable,
                  unpaidLeaveTaken,
                  paidLeaveTaken,
                  weekOff,
                  daysPaid,
                } = resolvePayslipBreakdown(selectedPayslip, selectedPayslip.userId);

                const rawAccount = (selectedPayslip.userId?.accountNumber || '').trim();
                const maskedAccount = rawAccount.length > 4 ? '*********' + rawAccount.slice(-4) : (rawAccount || '-');

                const fmt = (v: number | undefined | null) => (v != null ? Math.round(v).toString() : '0');

                return (
                  <div className="space-y-4 text-black bg-white p-4 sm:p-8 print:p-0 rounded-lg overflow-x-auto print:overflow-visible font-sans">
                    {/* Header Box - Logo on Top Right, Company Centered Below */}
                    <div className="mb-5">
                      <div className="flex justify-end mb-1">
                        {companyLogo ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={companyLogo} alt="Logo" className="h-9 max-w-[140px] object-contain" />
                        ) : (
                          <div className="h-9" />
                        )}
                      </div>
                      <div className="text-center">
                        <h1 className="text-2xl font-bold font-serif tracking-normal text-black mb-1">{companyName}</h1>
                        <p className="text-xs text-neutral-800 max-w-xl mx-auto leading-relaxed">{companyAddress}</p>
                      </div>
                    </div>

                    {/* Main Table Box */}
                    <div className="border-2 border-black overflow-hidden">
                      {/* Title */}
                      <div className="text-center font-bold text-sm py-2 border-b-2 border-black bg-white">
                        Payslip For The Month Of {monthName}
                      </div>

                      {/* Employee Details 4 Columns */}
                      <table className="w-full text-xs border-collapse">
                        <tbody>
                          <tr className="border-b border-black">
                            <td className="p-2 border-r border-black w-1/4 font-normal">Employee Name</td>
                            <td className="p-2 border-r border-black w-1/4 font-normal">{selectedPayslip.userId?.name || '-'}</td>
                            <td className="p-2 border-r border-black w-1/4 font-normal">Job Location</td>
                            <td className="p-2 w-1/4 text-right font-normal">{selectedPayslip.userId?.location || selectedPayslip.userId?.address || 'Coimbatore'}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-2 border-r border-black font-normal">Employee ID</td>
                            <td className="p-2 border-r border-black font-normal">{selectedPayslip.userId?.employeeId || '-'}</td>
                            <td className="p-2 border-r border-black font-normal">No of Days in Month</td>
                            <td className="p-2 text-right font-normal">{daysInMonth}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-2 border-r border-black font-normal">Designation</td>
                            <td className="p-2 border-r border-black font-normal">{selectedPayslip.userId?.designation || '-'}</td>
                            <td className="p-2 border-r border-black font-normal">Un-Paid Leave Taken</td>
                            <td className="p-2 text-right font-normal">{unpaidLeaveTaken}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-2 border-r border-black font-normal">Department</td>
                            <td className="p-2 border-r border-black font-normal">{selectedPayslip.userId?.department || '-'}</td>
                            <td className="p-2 border-r border-black font-normal">Paid Leave Taken</td>
                            <td className="p-2 text-right font-normal">{paidLeaveTaken}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-2 border-r border-black font-normal">Date of Joining</td>
                            <td className="p-2 border-r border-black font-normal">
                              {selectedPayslip.userId?.joiningDate ? format(new Date(selectedPayslip.userId.joiningDate), 'dd.MM.yyyy') : '-'}
                            </td>
                            <td className="p-2 border-r border-black font-normal">Week Off</td>
                            <td className="p-2 text-right font-normal">{weekOff}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-2 border-r border-black font-normal">Bank Name</td>
                            <td className="p-2 border-r border-black font-normal">{selectedPayslip.userId?.bankName || '-'}</td>
                            <td className="p-2 border-r border-black font-normal">Days Paid</td>
                            <td className="p-2 text-right font-normal">{daysPaid}</td>
                          </tr>
                          <tr className="border-b-2 border-black">
                            <td className="p-2 border-r border-black font-normal">A/c Number</td>
                            <td className="p-2 border-r border-black font-normal">{maskedAccount}</td>
                            <td className="p-2 border-r border-black font-normal"></td>
                            <td className="p-2 text-right font-normal"></td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Earnings & Deductions Table */}
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b-2 border-black text-center font-bold">
                            <th colSpan={2} className="p-2 border-r border-black w-1/2 uppercase text-center font-bold">Earnings</th>
                            <th colSpan={2} className="p-2 w-1/2 uppercase text-center font-bold">Deductions</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-black">
                            <td className="p-2 border-r border-black w-[35%]">Basic Salary</td>
                            <td className="p-2 border-r border-black w-[15%] text-right">{fmt(basicSalary)}</td>
                            <td className="p-2 border-r border-black w-[35%]">ESI</td>
                            <td className="p-2 w-[15%] text-right">{fmt(esi)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-2 border-r border-black">HRA</td>
                            <td className="p-2 border-r border-black text-right">{fmt(hraAllowance)}</td>
                            <td className="p-2 border-r border-black">TDS</td>
                            <td className="p-2 text-right">{fmt(tds)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-2 border-r border-black">DA</td>
                            <td className="p-2 border-r border-black text-right">{fmt(da)}</td>
                            <td className="p-2 border-r border-black">Company Loan Deductions</td>
                            <td className="p-2 text-right">{fmt(loan)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-2 border-r border-black">Bonus</td>
                            <td className="p-2 border-r border-black text-right">{fmt(bonus)}</td>
                            <td className="p-2 border-r border-black">Rental Deductions</td>
                            <td className="p-2 text-right">{fmt(rental)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-2 border-r border-black font-bold">Gross Earnings</td>
                            <td className="p-2 border-r border-black text-right font-bold">{fmt(grossEarnings)}</td>
                            <td className="p-2 border-r border-black">Other Deductions</td>
                            <td className="p-2 text-right">{fmt(otherDeductions)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-2 border-r border-black"></td>
                            <td className="p-2 border-r border-black text-right"></td>
                            <td className="p-2 border-r border-black">Loss of Pay</td>
                            <td className="p-2 text-right">{fmt(lossOfPay)}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-2 border-r border-black"></td>
                            <td className="p-2 border-r border-black text-right"></td>
                            <td className="p-2 border-r border-black font-bold">Total Deductions</td>
                            <td className="p-2 text-right font-bold">{fmt(totalDeductions)}</td>
                          </tr>
                          <tr className="border-b-2 border-black">
                            <td className="p-2 border-r border-black"></td>
                            <td className="p-2 border-r border-black text-right"></td>
                            <td className="p-2 border-r border-black font-bold">Net Payable</td>
                            <td className="p-2 text-right font-bold">{fmt(netPayable)}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Footer Note Box */}
                      <div className="p-3 text-[11px] leading-relaxed border-t-2 border-black text-neutral-800">
                        <div><span className="font-bold">Note:</span> This is a computer-generated payslip and does not require a physical signature.</div>
                        <div className="pl-6">For any queries or discrepancies regarding this payslip, please contact the HR Department.</div>
                        <div><span className="font-bold">Confidential:</span> This document contains confidential employee salary information.</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
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

