import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative',
    height: 40,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  companyName: {
    position: 'absolute',
    right: 0,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  table: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
  },
  lastRow: {
    flexDirection: 'row',
  },
  cellLabel: {
    width: '25%',
    padding: 6,
    fontSize: 10,
    borderRightWidth: 1,
    borderRightColor: '#000',
  },
  cellValue: {
    width: '25%',
    padding: 6,
    fontSize: 10,
    borderRightWidth: 1,
    borderRightColor: '#000',
  },
  cellValueLast: {
    width: '25%',
    padding: 6,
    fontSize: 10,
  },
  cellHeader50: {
    width: '50%',
    padding: 6,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cellRight: {
    textAlign: 'right',
  },
  cellNetPayableLabel: {
    width: '75%',
    padding: 6,
    fontSize: 12,
    fontWeight: 'bold',
    borderRightWidth: 1,
    borderRightColor: '#000',
    textAlign: 'right',
  },
  cellNetPayableValue: {
    width: '25%',
    padding: 6,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'right',
  },
});

interface PayslipProps {
  payroll: any;
  user: any;
  company: any;
}

export const PayslipDocument = ({ payroll, user, company }: PayslipProps) => {
  const monthName = format(new Date(payroll.year, payroll.month - 1), 'MMM yyyy');
  const formatCurrency = (val: number) => `\u20B9${(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const monthlySalary = payroll.monthlySalary || 0;
  const basicSalary = payroll.basicSalary ?? Math.round(monthlySalary * 0.5);
  const hraAllowance = payroll.hra ?? Math.round(monthlySalary * 0.15);
  const otherAllowances = payroll.da ?? (monthlySalary - basicSalary - hraAllowance);
  const bonus = payroll.bonus || 0;
  const grossSalary = basicSalary + hraAllowance + otherAllowances + bonus;

  const totalDeductions = payroll.deductionAmount ?? payroll.deductions ?? 0;
  const esi = payroll.salaryDeductionsSnapshot?.esi || 0;
  const rentalDeduction = user?.salaryDeductions?.hra?.amount || payroll.salaryDeductionsSnapshot?.hra || 0;
  const loan = payroll.salaryDeductionsSnapshot?.loan || 0;
  
  const lossOfPay = Math.max(0, totalDeductions - esi - rentalDeduction - loan);
  const otherDeductions = lossOfPay + loan;

  const netSalary = monthlySalary - totalDeductions;
  const daysPaid = (payroll.totalWorkingDays || 0) - (payroll.absentDays || 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>PAY SLIP</Text>
          <Text style={[styles.companyName, { color: '#d32f2f', fontFamily: 'Helvetica' }]}>{company?.companyName?.toUpperCase() || 'COMPANY NAME'}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Employee Name</Text>
            <Text style={styles.cellValue}>{user?.name || '-'}</Text>
            <Text style={styles.cellLabel}>Month</Text>
            <Text style={styles.cellValueLast}>{monthName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Designation</Text>
            <Text style={styles.cellValue}>{user?.designation || '-'}</Text>
            <Text style={styles.cellLabel}>Total Working Days</Text>
            <Text style={styles.cellValueLast}>{payroll.totalWorkingDays || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Date of Joining</Text>
            <Text style={styles.cellValue}>{user?.joiningDate ? format(new Date(user.joiningDate), 'dd.MM.yyyy') : '-'}</Text>
            <Text style={styles.cellLabel}>Un-Paid Leave Taken</Text>
            <Text style={styles.cellValueLast}>{payroll.absentDays || 0}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Job Location</Text>
            <Text style={styles.cellValue}>{user?.location || user?.address || 'Coimbatore'}</Text>
            <Text style={styles.cellLabel}>Days Paid</Text>
            <Text style={styles.cellValueLast}>{daysPaid}</Text>
          </View>
          <View style={styles.lastRow}>
            <Text style={styles.cellLabel}>Bank Name</Text>
            <Text style={styles.cellValue}>{user?.bankName || '-'}</Text>
            <Text style={styles.cellLabel}>A/c Number</Text>
            <Text style={styles.cellValueLast}>{user?.accountNumber || '-'}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, { backgroundColor: '#fafafa' }]}>
            <Text style={[styles.cellLabel, { textAlign: 'center' }]}>Leave Record</Text>
            <Text style={[styles.cellLabel, { textAlign: 'center' }]}>Total</Text>
            <Text style={[styles.cellLabel, { textAlign: 'center' }]}>Taken</Text>
            <Text style={[styles.cellValueLast, { textAlign: 'center' }]}>Balance</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.cellLabel, { textAlign: 'center' }]}>Casual Leave</Text>
            <Text style={[styles.cellLabel, { textAlign: 'center' }]}>{user?.leaveBalance?.casualLeave?.total || 0}</Text>
            <Text style={[styles.cellLabel, { textAlign: 'center', backgroundColor: '#fafafa' }]}>{user?.leaveBalance?.casualLeave?.taken || 0}</Text>
            <Text style={[styles.cellValueLast, { textAlign: 'center' }]}>{user?.leaveBalance?.casualLeave?.available || 0}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.cellLabel, { textAlign: 'center' }]}>Sick Leave</Text>
            <Text style={[styles.cellLabel, { textAlign: 'center' }]}>{user?.leaveBalance?.sickLeave?.total || 0}</Text>
            <Text style={[styles.cellLabel, { textAlign: 'center', backgroundColor: '#fafafa' }]}>{user?.leaveBalance?.sickLeave?.taken || 0}</Text>
            <Text style={[styles.cellValueLast, { textAlign: 'center' }]}>{user?.leaveBalance?.sickLeave?.available || 0}</Text>
          </View>
          <View style={styles.lastRow}>
            <Text style={[styles.cellLabel, { textAlign: 'center' }]}>Restricted Holiday</Text>
            <Text style={[styles.cellLabel, { textAlign: 'center' }]}>{user?.leaveBalance?.restrictedLeave?.total || 0}</Text>
            <Text style={[styles.cellLabel, { textAlign: 'center', backgroundColor: '#fafafa' }]}>{user?.leaveBalance?.restrictedLeave?.taken || 0}</Text>
            <Text style={[styles.cellValueLast, { textAlign: 'center' }]}>{user?.leaveBalance?.restrictedLeave?.available || 0}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, { backgroundColor: '#fafafa' }]}>
            <Text style={[styles.cellHeader50, { borderRightWidth: 1, borderRightColor: '#000' }]}>SALARY</Text>
            <Text style={styles.cellHeader50}>DEDUCTION</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Basic Salary</Text>
            <Text style={[styles.cellValue, styles.cellRight]}>{formatCurrency(basicSalary)}</Text>
            <Text style={styles.cellLabel}>TDS</Text>
            <Text style={[styles.cellValueLast, styles.cellRight]}>{formatCurrency(0)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>HRA</Text>
            <Text style={[styles.cellValue, styles.cellRight]}>{formatCurrency(hraAllowance)}</Text>
            <Text style={styles.cellLabel}>ESI</Text>
            <Text style={[styles.cellValueLast, styles.cellRight]}>{formatCurrency(esi)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Other Allowances</Text>
            <Text style={[styles.cellValue, styles.cellRight]}>{formatCurrency(otherAllowances)}</Text>
            <Text style={styles.cellLabel}>Rental Deduction</Text>
            <Text style={[styles.cellValueLast, styles.cellRight]}>{formatCurrency(rentalDeduction)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Bonus</Text>
            <Text style={[styles.cellValue, styles.cellRight]}>{formatCurrency(bonus)}</Text>
            <Text style={styles.cellLabel}>Other Deduction</Text>
            <Text style={[styles.cellValueLast, styles.cellRight]}>{formatCurrency(otherDeductions)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Gross Total</Text>
            <Text style={[styles.cellValue, styles.cellRight]}>{formatCurrency(grossSalary)}</Text>
            <Text style={styles.cellLabel}>Total Deductions</Text>
            <Text style={[styles.cellValueLast, styles.cellRight]}>{formatCurrency(totalDeductions)}</Text>
          </View>
          <View style={styles.lastRow}>
            <Text style={styles.cellNetPayableLabel}>Net Payable</Text>
            <Text style={styles.cellNetPayableValue}>{formatCurrency(netSalary)}</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
};
