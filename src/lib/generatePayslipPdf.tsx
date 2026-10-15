import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { PayslipDocument } from '@/components/PayslipDocument';
import path from 'path';
import fs from 'fs';

export async function generatePayslipPdf(payroll: any, user: any, company: any): Promise<Buffer> {
  let resolvedLogo: string | null = null;

  if (company?.logo) {
    if (company.logo.startsWith('http://') || company.logo.startsWith('https://')) {
      resolvedLogo = company.logo;
    } else {
      const cleanPath = company.logo.replace(/^\//, '');
      const fullDiskPath = path.join(process.cwd(), 'public', cleanPath);
      if (fs.existsSync(fullDiskPath)) {
        resolvedLogo = fullDiskPath;
      }
    }
  }

  // Fallback to truflow.png if logo not set or not found
  if (!resolvedLogo) {
    const defaultLogo = path.join(process.cwd(), 'public', 'logo', 'truflow.png');
    if (fs.existsSync(defaultLogo)) {
      resolvedLogo = defaultLogo;
    }
  }

  const companyForPdf = {
    ...company,
    resolvedLogo,
  };

  const pdfBuffer = await renderToBuffer(
    <PayslipDocument payroll={payroll} user={user} company={companyForPdf} />
  );

  return pdfBuffer;
}
