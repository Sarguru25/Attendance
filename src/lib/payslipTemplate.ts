import { format } from 'date-fns';

export function generatePayslipHtml(payroll: any, user: any, company: any) {
  const monthName = format(new Date(payroll.year, payroll.month - 1), 'MMMM yyyy');
  
  const monthlySalary = payroll.monthlySalary || 0;
  const basicSalary = payroll.basicSalary ?? Math.round(monthlySalary * 0.5);
  const hraAllowance = payroll.hra ?? Math.round(monthlySalary * 0.15);
  const otherAllowances = payroll.da ?? (monthlySalary - basicSalary - hraAllowance);
  
  const totalDeductions = payroll.deductionAmount ?? payroll.deductions ?? 0;
  const esi = payroll.salaryDeductionsSnapshot?.esi || 0;
  const rentalDeduction = payroll.salaryDeductionsSnapshot?.hra || 0;
  const loan = payroll.salaryDeductionsSnapshot?.loan || 0;
  
  const lossOfPay = Math.max(0, totalDeductions - esi - rentalDeduction - loan);
  const otherDeductions = lossOfPay + loan;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Payslip - ${monthName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
    body { font-family: 'Inter', sans-serif; background: white; color: black; }
    /* Mimic print styles from Tailwind */
    .text-neutral-500 { color: #737373; }
    .text-neutral-900 { color: #171717; }
    .bg-neutral-50 { background-color: #fafafa; }
    .bg-neutral-100 { background-color: #f5f5f5; }
    .border-neutral-200 { border-color: #e5e5e5; }
    .border-neutral-300 { border-color: #d4d4d4; }
    .text-green-600 { color: #16a34a; }
    .text-red-600 { color: #dc2626; }
    .text-pink-600 { color: #db2777; }
    .text-blue-600 { color: #2563eb; }
    .text-blue-900 { color: #1e3a8a; }
    .text-blue-700 { color: #1d4ed8; }
    .bg-blue-50 { background-color: #eff6ff; }
    .border-blue-100 { border-color: #dbeafe; }
  </style>
</head>
<body class="p-8 max-w-4xl mx-auto">
  <div class="space-y-8">
    <div class="flex justify-between items-end border-b-2 border-neutral-200 pb-6">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-neutral-900">PAYSLIP</h1>
        <p class="text-neutral-500 mt-1 font-bold">${monthName}</p>
      </div>
      <div class="text-right">
        <h2 class="text-xl font-bold text-neutral-900">${company?.companyName || 'Company Name'}</h2>
        <p class="text-sm font-bold text-neutral-500">${company?.address || 'Company Address'}</p>
        <p class="text-sm font-bold text-neutral-500">${company?.email || 'email@company.com'} | ${company?.phone || 'Phone'}</p>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-8">
      <div class="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
        <h3 class="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-3">Employee Details</h3>
        <div class="grid grid-cols-2 gap-y-2 text-sm">
          <div class="text-neutral-500 font-bold">Employee ID:</div>
          <div class="font-bold text-neutral-900">${user?.employeeId || '-'}</div>
          <div class="text-neutral-500 font-bold">Name:</div>
          <div class="font-bold text-neutral-900">${user?.name || '-'}</div>
          <div class="text-neutral-500 font-bold">Department:</div>
          <div class="font-bold text-neutral-900">${user?.department || '-'}</div>
          <div class="text-neutral-500 font-bold">Designation:</div>
          <div class="font-bold text-neutral-900">${user?.designation || '-'}</div>
        </div>
      </div>
      <div class="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
        <h3 class="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-3">Bank Details</h3>
        <div class="grid grid-cols-2 gap-y-2 text-sm">
          <div class="text-neutral-500 font-bold">Bank Name:</div>
          <div class="font-bold text-neutral-900">${user?.bankName || '-'}</div>
          <div class="text-neutral-500 font-bold">Account No:</div>
          <div class="font-bold text-neutral-900">${user?.accountNumber || '-'}</div>
          <div class="text-neutral-500 font-bold">IFSC Code:</div>
          <div class="font-bold text-neutral-900">${user?.ifscCode || '-'}</div>
        </div>
      </div>
    </div>

    <div class="bg-neutral-50 p-4 rounded-xl border border-neutral-200 grid grid-cols-6 text-sm">
      <div class="text-center px-2">
        <div class="text-neutral-500 font-bold mb-1">Calendar Days</div>
        <div class="font-bold text-lg text-neutral-900">${payroll.totalCalendarDays || '-'}</div>
      </div>
      <div class="text-center px-2 border-l border-neutral-200">
        <div class="text-neutral-500 font-bold mb-1">Working Days</div>
        <div class="font-bold text-lg text-neutral-900">${payroll.totalWorkingDays || 0}</div>
      </div>
      <div class="text-center px-2 border-l border-neutral-200">
        <div class="text-neutral-500 font-bold mb-1">Present</div>
        <div class="font-bold text-lg text-green-600">${payroll.presentDays || 0}</div>
      </div>
      <div class="text-center px-2 border-l border-neutral-200">
        <div class="text-neutral-500 font-bold mb-1">Absent</div>
        <div class="font-bold text-lg text-red-600">${payroll.absentDays || 0}</div>
      </div>
      <div class="text-center px-2 border-l border-neutral-200">
        <div class="text-neutral-500 font-bold mb-1">Leave</div>
        <div class="font-bold text-lg text-pink-600">${payroll.leaveDays || 0}</div>
      </div>
      <div class="text-center px-2 border-l border-neutral-200">
        <div class="text-neutral-500 font-bold mb-1">Weekly Offs</div>
        <div class="font-bold text-lg text-blue-600">${payroll.weeklyOffDays || 0}</div>
      </div>
    </div>

    <div class="overflow-hidden">
      <table class="min-w-full w-full text-sm text-left">
        <thead>
          <tr class="bg-neutral-100 border-y border-neutral-200">
            <th class="px-4 py-3 font-bold text-neutral-900">Earnings</th>
            <th class="px-4 py-3 text-right font-bold text-neutral-900">Amount</th>
            <th class="px-4 py-3 font-bold text-neutral-900">Deductions</th>
            <th class="px-4 py-3 text-right font-bold text-neutral-900">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr class="border-b border-neutral-200">
            <td class="px-4 py-3 font-bold text-neutral-900">Basic Salary</td>
            <td class="px-4 py-3 text-right font-bold text-neutral-900">₹${basicSalary.toLocaleString()}</td>
            <td class="px-4 py-3 font-bold text-neutral-900">TDS</td>
            <td class="px-4 py-3 text-right font-bold text-red-600">-₹0</td>
          </tr>
          <tr class="border-b border-neutral-200">
            <td class="px-4 py-3 font-bold text-neutral-900">HRA</td>
            <td class="px-4 py-3 text-right font-bold text-neutral-900">₹${hraAllowance.toLocaleString()}</td>
            <td class="px-4 py-3 font-bold text-neutral-900">ESI</td>
            <td class="px-4 py-3 text-right font-bold text-red-600">-₹${esi.toLocaleString()}</td>
          </tr>
          <tr class="border-b border-neutral-200">
            <td class="px-4 py-3 font-bold text-neutral-900">Other Allowances</td>
            <td class="px-4 py-3 text-right font-bold text-neutral-900">₹${otherAllowances.toLocaleString()}</td>
            <td class="px-4 py-3 font-bold text-neutral-900">Rental Deduction</td>
            <td class="px-4 py-3 text-right font-bold text-red-600">-₹${rentalDeduction.toLocaleString()}</td>
          </tr>
          <tr class="border-b border-neutral-200">
            <td class="px-4 py-3 font-bold text-neutral-900">Bonus</td>
            <td class="px-4 py-3 text-right font-bold text-neutral-900">₹0</td>
            <td class="px-4 py-3 font-bold text-neutral-900">Other Deduction</td>
            <td class="px-4 py-3 text-right font-bold text-red-600">-₹${otherDeductions.toLocaleString()}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="bg-neutral-50 font-bold">
            <td class="px-4 py-3 text-neutral-900">Total Earnings</td>
            <td class="px-4 py-3 text-right text-neutral-900">₹${(payroll.grossSalary || payroll.monthlySalary || 0).toLocaleString()}</td>
            <td class="px-4 py-3 text-neutral-900">Total Deductions</td>
            <td class="px-4 py-3 text-right text-red-600">-₹${((payroll.deductionAmount ?? payroll.deductions) || 0).toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="flex justify-between items-center bg-blue-50 p-6 rounded-xl border border-blue-100 mt-6">
      <div class="text-lg text-blue-900 font-bold">Net Salary Payable</div>
      <div class="text-3xl font-black text-blue-700">₹${(payroll.netSalary || payroll.finalSalary || 0).toLocaleString()}</div>
    </div>

    <div class="pt-16 pb-8 flex justify-between items-center px-12 text-sm text-neutral-500 font-bold">
      <div class="text-center border-t border-neutral-300 pt-2 w-48">Employer Signature</div>
      <div class="text-center border-t border-neutral-300 pt-2 w-48">Employee Signature</div>
    </div>
  </div>
</body>
</html>
  `;
}
