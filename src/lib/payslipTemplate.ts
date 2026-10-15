import { format } from 'date-fns';
import { resolvePayslipBreakdown } from '@/lib/salaryUtils';

export function generatePayslipHtml(payroll: any, user: any, company: any) {
  const monthDate = new Date(payroll.year, payroll.month - 1);
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
  } = resolvePayslipBreakdown(payroll, user);

  const rawAccount = (user?.accountNumber || '').trim();
  const maskedAccount = rawAccount.length > 4 ? '*********' + rawAccount.slice(-4) : (rawAccount || '-');

  const formatAmount = (val: number | undefined | null) => (val != null ? Math.round(val).toString() : '0');

  const companyName = company?.companyName || 'Truflow Solutions Private Limited';
  const companyAddress = company?.address || 'S.F.No.617/2H2, Vadakku Thottam, L&T Road, Malumichampatti, Coimbatore, Tamil Nadu-641050';
  const logoSrc = company?.logo || '/logo/truflow.png';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Payslip - ${monthName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fff; color: #000; padding: 24px; }
    .container { max-width: 800px; margin: 0 auto; }
    
    .header-box { margin-bottom: 16px; }
    .logo-row { display: flex; justify-content: flex-end; margin-bottom: 4px; }
    .logo-img { height: 36px; max-width: 150px; object-fit: contain; }
    .company-title { font-family: "Times New Roman", Times, serif; font-size: 22px; font-weight: bold; margin-bottom: 4px; text-align: center; }
    .company-address { font-size: 11px; color: #222; max-width: 85%; margin: 0 auto; text-align: center; }

    .payslip-box { border: 2px solid #000; width: 100%; border-collapse: collapse; }
    .payslip-title { text-align: center; font-weight: bold; font-size: 13px; padding: 7px; border-bottom: 2px solid #000; }
    
    table.data-table { width: 100%; border-collapse: collapse; }
    table.data-table td, table.data-table th { border: 1px solid #000; padding: 6px 8px; font-size: 12px; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    
    .border-b-2 { border-bottom: 2px solid #000 !important; }
    .border-r { border-right: 1px solid #000 !important; }
    
    .footer-box { padding: 10px 12px; font-size: 11px; line-height: 1.45; border-top: 2px solid #000; }
    .footer-indent { padding-left: 30px; margin: 2px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-box">
      ${logoSrc ? `
      <div class="logo-row">
        <img src="${logoSrc}" alt="Logo" class="logo-img" />
      </div>` : ''}
      <div class="company-text">
        <h1 class="company-title">${companyName}</h1>
        <p class="company-address">${companyAddress}</p>
      </div>
    </div>

    <div class="payslip-box">
      <div class="payslip-title">
        Payslip For The Month Of ${monthName}
      </div>

      <table class="data-table">
        <tbody>
          <tr>
            <td style="width: 25%;">Employee Name</td>
            <td style="width: 25%;">${user?.name || '-'}</td>
            <td style="width: 25%;">Job Location</td>
            <td style="width: 25%;" class="text-right">${user?.location || user?.address || 'Coimbatore'}</td>
          </tr>
          <tr>
            <td>Employee ID</td>
            <td>${user?.employeeId || '-'}</td>
            <td>No of Days in Month</td>
            <td class="text-right">${daysInMonth}</td>
          </tr>
          <tr>
            <td>Designation</td>
            <td>${user?.designation || '-'}</td>
            <td>Un-Paid Leave Taken</td>
            <td class="text-right">${unpaidLeaveTaken}</td>
          </tr>
          <tr>
            <td>Department</td>
            <td>${user?.department || '-'}</td>
            <td>Paid Leave Taken</td>
            <td class="text-right">${paidLeaveTaken}</td>
          </tr>
          <tr>
            <td>Date of Joining</td>
            <td>${user?.joiningDate ? format(new Date(user.joiningDate), 'dd.MM.yyyy') : '-'}</td>
            <td>Week Off</td>
            <td class="text-right">${weekOff}</td>
          </tr>
          <tr>
            <td>Bank Name</td>
            <td>${user?.bankName || '-'}</td>
            <td>Days Paid</td>
            <td class="text-right">${daysPaid}</td>
          </tr>
          <tr class="border-b-2">
            <td>A/c Number</td>
            <td>${maskedAccount}</td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <table class="data-table">
        <thead>
          <tr class="border-b-2">
            <th colspan="2" class="text-center font-bold border-r" style="width: 50%;">Earnings</th>
            <th colspan="2" class="text-center font-bold" style="width: 50%;">Deductions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="width: 35%;">Basic Salary</td>
            <td style="width: 15%;" class="text-right border-r">${formatAmount(basicSalary)}</td>
            <td style="width: 35%;">ESI</td>
            <td style="width: 15%;" class="text-right">${formatAmount(esi)}</td>
          </tr>
          <tr>
            <td>HRA</td>
            <td class="text-right border-r">${formatAmount(hraAllowance)}</td>
            <td>TDS</td>
            <td class="text-right">${formatAmount(tds)}</td>
          </tr>
          <tr>
            <td>DA</td>
            <td class="text-right border-r">${formatAmount(da)}</td>
            <td>Company Loan Deductions</td>
            <td class="text-right">${formatAmount(loan)}</td>
          </tr>
          <tr>
            <td>Bonus</td>
            <td class="text-right border-r">${formatAmount(bonus)}</td>
            <td>Rental Deductions</td>
            <td class="text-right">${formatAmount(rental)}</td>
          </tr>
          <tr>
            <td class="font-bold">Gross Earnings</td>
            <td class="text-right font-bold border-r">${formatAmount(grossEarnings)}</td>
            <td>Other Deductions</td>
            <td class="text-right">${formatAmount(otherDeductions)}</td>
          </tr>
          <tr>
            <td></td>
            <td class="border-r"></td>
            <td>Loss of Pay</td>
            <td class="text-right">${formatAmount(lossOfPay)}</td>
          </tr>
          <tr>
            <td></td>
            <td class="border-r"></td>
            <td class="font-bold">Total Deductions</td>
            <td class="text-right font-bold">${formatAmount(totalDeductions)}</td>
          </tr>
          <tr>
            <td></td>
            <td class="border-r"></td>
            <td class="font-bold">Net Payable</td>
            <td class="text-right font-bold">${formatAmount(netPayable)}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer-box">
        <div><strong>Note:</strong> This is a computer-generated payslip and does not require a physical signature.</div>
        <div class="footer-indent">For any queries or discrepancies regarding this payslip, please contact the HR Department.</div>
        <div><strong>Confidential:</strong> This document contains confidential employee salary information.</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
