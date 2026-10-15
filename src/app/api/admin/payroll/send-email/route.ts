import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Payroll from '@/models/Payroll';
import User from '@/models/User';
import { format } from 'date-fns';
import { sendEmail } from '@/lib/emailService';
import { generatePayslipPdf } from '@/lib/generatePayslipPdf';
import Company from '@/models/Company';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // ================= AUTH =================
    const session = await auth();
    if (!session || !['super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { payrollId } = await req.json();

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
    
    if (!user.email) {
      return NextResponse.json({ error: 'Employee email not found' }, { status: 400 });
    }
    
    const monthName = format(new Date(payroll.year, payroll.month - 1), 'MMMM yyyy');
    let company = payroll.companyId ? await Company.findById(payroll.companyId) : null;
    if (!company && user?.companyId) {
      company = await Company.findById(user.companyId);
    }
    if (!company) {
      company = await Company.findOne({ status: true });
    }

    // ================= GENERATE PDF =================
    const pdfBuffer = await generatePayslipPdf(payroll, user, company);

    // ================= VALIDATION =================
    if (!pdfBuffer || pdfBuffer.length < 1000) {
      throw new Error('PDF generation failed (empty or corrupted buffer)');
    }

    const fileName = `Payslip_${user.employeeId}_${monthName}.pdf`;

    // ================= EMAIL =================
    await sendEmail({
      to: user.email,
      subject: `Your Payslip for ${monthName}`,
      html: `
        <p>Dear ${user.name},</p>
        <p>Please find attached your payslip for ${monthName}.</p>
        <p>Regards,<br>HR Team</p>
      `,
      attachments: [
        {
          filename: fileName,
          content: Buffer.from(pdfBuffer),
        },
      ],
    });

    return NextResponse.json({
      success: true,
      message: 'Payslip sent successfully',
      data: null,
    });

  } catch (err: any) {
    console.error('Email/PDF Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}