import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { resolvePayslipBreakdown } from '@/lib/salaryUtils';

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 32,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  headerWrapper: {
    marginBottom: 14,
    alignItems: 'center',
    width: '100%',
  },
  logoRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 2,
    minHeight: 28,
  },
  logoImage: {
    width: 120,
    height: 28,
    objectFit: 'contain',
  },
  companyName: {
    fontFamily: 'Times-Bold',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 4,
    color: '#000000',
  },
  companyAddress: {
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    textAlign: 'center',
    color: '#111111',
    maxWidth: '85%',
    lineHeight: 1.3,
  },
  mainBox: {
    borderWidth: 1.5,
    borderColor: '#000000',
    width: '100%',
  },
  titleRow: {
    paddingVertical: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
    textAlign: 'center',
  },
  titleText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  rowThickBottom: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
  },
  cellLabel: {
    width: '25%',
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    fontSize: 8.5,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  cellValue: {
    width: '25%',
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    fontSize: 8.5,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  cellValueRight: {
    width: '25%',
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    fontSize: 8.5,
    textAlign: 'right',
  },
  earnDedHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
  },
  earnHeaderCol: {
    width: '50%',
    paddingVertical: 5,
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  dedHeaderCol: {
    width: '50%',
    paddingVertical: 5,
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
  },
  earnLabelCell: {
    width: '35%',
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    fontSize: 8.5,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  earnAmountCell: {
    width: '15%',
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    fontSize: 8.5,
    textAlign: 'right',
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  dedLabelCell: {
    width: '35%',
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    fontSize: 8.5,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  dedAmountCell: {
    width: '15%',
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    fontSize: 8.5,
    textAlign: 'right',
  },
  boldText: {
    fontFamily: 'Helvetica-Bold',
  },
  footerBox: {
    borderTopWidth: 1.5,
    borderTopColor: '#000000',
    padding: 7,
    fontSize: 7.5,
    lineHeight: 1.35,
  },
  footerLine: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  footerBold: {
    fontFamily: 'Helvetica-Bold',
  },
});

interface PayslipProps {
  payroll: any;
  user: any;
  company: any;
}

export const PayslipDocument = ({ payroll, user, company }: PayslipProps) => {
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

  // Masked Account Number
  const rawAccount = (user?.accountNumber || '').trim();
  const maskedAccount = rawAccount.length > 4 ? '*********' + rawAccount.slice(-4) : (rawAccount || '-');

  const formatAmount = (val: number | undefined | null) => (val != null ? Math.round(val).toString() : '0');

  // Company details
  const companyName = company?.companyName || 'Truflow Solutions Private Limited';
  const companyAddress = company?.address || 'S.F.No.617/2H2, Vadakku Thottam, L&T Road, Malumichampatti, Coimbatore, Tamil Nadu-641050';
  const logoSrc = company?.resolvedLogo || company?.logo || null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Top Header */}
        <View style={styles.headerWrapper}>
          <View style={styles.logoRow}>
            {logoSrc && <Image src={logoSrc} style={styles.logoImage} />}
          </View>
          <Text style={styles.companyName}>{companyName}</Text>
          <Text style={styles.companyAddress}>{companyAddress}</Text>
        </View>

        {/* Main Box */}
        <View style={styles.mainBox}>
          {/* Title Row */}
          <View style={styles.titleRow}>
            <Text style={styles.titleText}>Payslip For The Month Of {monthName}</Text>
          </View>

          {/* Employee Details (4 columns) */}
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Employee Name</Text>
            <Text style={styles.cellValue}>{user?.name || '-'}</Text>
            <Text style={styles.cellLabel}>Job Location</Text>
            <Text style={styles.cellValueRight}>{user?.location || user?.address || 'Coimbatore'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.cellLabel}>Employee ID</Text>
            <Text style={styles.cellValue}>{user?.employeeId || '-'}</Text>
            <Text style={styles.cellLabel}>No of Days in Month</Text>
            <Text style={styles.cellValueRight}>{daysInMonth}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.cellLabel}>Designation</Text>
            <Text style={styles.cellValue}>{user?.designation || '-'}</Text>
            <Text style={styles.cellLabel}>Un-Paid Leave Taken</Text>
            <Text style={styles.cellValueRight}>{unpaidLeaveTaken}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.cellLabel}>Department</Text>
            <Text style={styles.cellValue}>{user?.department || '-'}</Text>
            <Text style={styles.cellLabel}>Paid Leave Taken</Text>
            <Text style={styles.cellValueRight}>{paidLeaveTaken}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.cellLabel}>Date of Joining</Text>
            <Text style={styles.cellValue}>
              {user?.joiningDate ? format(new Date(user.joiningDate), 'dd.MM.yyyy') : '-'}
            </Text>
            <Text style={styles.cellLabel}>Week Off</Text>
            <Text style={styles.cellValueRight}>{weekOff}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.cellLabel}>Bank Name</Text>
            <Text style={styles.cellValue}>{user?.bankName || '-'}</Text>
            <Text style={styles.cellLabel}>Days Paid</Text>
            <Text style={styles.cellValueRight}>{daysPaid}</Text>
          </View>

          <View style={styles.rowThickBottom}>
            <Text style={styles.cellLabel}>A/c Number</Text>
            <Text style={styles.cellValue}>{maskedAccount}</Text>
            <Text style={styles.cellLabel}></Text>
            <Text style={styles.cellValueRight}></Text>
          </View>

          {/* Earnings & Deductions Section */}
          <View style={styles.earnDedHeader}>
            <Text style={styles.earnHeaderCol}>Earnings</Text>
            <Text style={styles.dedHeaderCol}>Deductions</Text>
          </View>

          {/* Row 1 */}
          <View style={styles.row}>
            <Text style={styles.earnLabelCell}>Basic Salary</Text>
            <Text style={styles.earnAmountCell}>{formatAmount(basicSalary)}</Text>
            <Text style={styles.dedLabelCell}>ESI</Text>
            <Text style={styles.dedAmountCell}>{formatAmount(esi)}</Text>
          </View>

          {/* Row 2 */}
          <View style={styles.row}>
            <Text style={styles.earnLabelCell}>HRA</Text>
            <Text style={styles.earnAmountCell}>{formatAmount(hraAllowance)}</Text>
            <Text style={styles.dedLabelCell}>TDS</Text>
            <Text style={styles.dedAmountCell}>{formatAmount(tds)}</Text>
          </View>

          {/* Row 3 */}
          <View style={styles.row}>
            <Text style={styles.earnLabelCell}>DA</Text>
            <Text style={styles.earnAmountCell}>{formatAmount(da)}</Text>
            <Text style={styles.dedLabelCell}>Company Loan Deductions</Text>
            <Text style={styles.dedAmountCell}>{formatAmount(loan)}</Text>
          </View>

          {/* Row 4 */}
          <View style={styles.row}>
            <Text style={styles.earnLabelCell}>Bonus</Text>
            <Text style={styles.earnAmountCell}>{formatAmount(bonus)}</Text>
            <Text style={styles.dedLabelCell}>Rental Deductions</Text>
            <Text style={styles.dedAmountCell}>{formatAmount(rental)}</Text>
          </View>

          {/* Row 5: Gross Earnings */}
          <View style={styles.row}>
            <Text style={[styles.earnLabelCell, styles.boldText]}>Gross Earnings</Text>
            <Text style={[styles.earnAmountCell, styles.boldText]}>{formatAmount(grossEarnings)}</Text>
            <Text style={styles.dedLabelCell}>Other Deductions</Text>
            <Text style={styles.dedAmountCell}>{formatAmount(otherDeductions)}</Text>
          </View>

          {/* Row 6: Loss of Pay */}
          <View style={styles.row}>
            <Text style={styles.earnLabelCell}></Text>
            <Text style={styles.earnAmountCell}></Text>
            <Text style={styles.dedLabelCell}>Loss of Pay</Text>
            <Text style={styles.dedAmountCell}>{formatAmount(lossOfPay)}</Text>
          </View>

          {/* Row 7: Total Deductions */}
          <View style={styles.row}>
            <Text style={styles.earnLabelCell}></Text>
            <Text style={styles.earnAmountCell}></Text>
            <Text style={[styles.dedLabelCell, styles.boldText]}>Total Deductions</Text>
            <Text style={[styles.dedAmountCell, styles.boldText]}>{formatAmount(totalDeductions)}</Text>
          </View>

          {/* Row 8: Net Payable */}
          <View style={styles.row}>
            <Text style={styles.earnLabelCell}></Text>
            <Text style={styles.earnAmountCell}></Text>
            <Text style={[styles.dedLabelCell, styles.boldText]}>Net Payable</Text>
            <Text style={[styles.dedAmountCell, styles.boldText]}>{formatAmount(netPayable)}</Text>
          </View>

          {/* Footer Note */}
          <View style={styles.footerBox}>
            <Text style={{ marginBottom: 3 }}>
              <Text style={styles.footerBold}>Note: </Text>
              This is a computer-generated payslip and does not require a physical signature.
            </Text>
            <Text style={{ marginBottom: 3, paddingLeft: 22 }}>
              For any queries or discrepancies regarding this payslip, please contact the HR Department.
            </Text>
            <Text>
              <Text style={styles.footerBold}>Confidential: </Text>
              This document contains confidential employee salary information.
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
export default PayslipDocument;
