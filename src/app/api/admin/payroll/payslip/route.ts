import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Payroll from '@/models/Payroll';
import User from '@/models/User';
import { format } from 'date-fns';
import Company from '@/models/Company';
import { generatePayslipPdf } from '@/lib/generatePayslipPdf';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const payrollId = searchParams.get('payrollId');

    if (!payrollId) {
      return NextResponse.json({ error: 'Payroll ID is required' }, { status: 400 });
    }

    await dbConnect();

    const payroll = await Payroll.findById(payrollId).populate({
      path: 'userId',
      model: User,
    });

    if (!payroll) {
      return NextResponse.json({ error: 'Payroll not found' }, { status: 404 });
    }

    const user = payroll.userId as any;
    const monthName = format(new Date(payroll.year, payroll.month - 1), 'MMMM yyyy');

    let company = payroll.companyId ? await Company.findById(payroll.companyId) : null;
    if (!company && user?.companyId) {
      company = await Company.findById(user.companyId);
    }
    if (!company) {
      company = await Company.findOne({ status: true });
    }
    
    const pdfBuffer = await generatePayslipPdf(payroll, user, company);

    if (!pdfBuffer || pdfBuffer.length < 1000) {
      throw new Error('PDF generation failed');
    }

    const fileName = `Payslip_${user.employeeId}_${monthName}.pdf`;

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });

  } catch (err: any) {
    console.error('PDF Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
