import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import GeneratedLetter from '@/models/GeneratedLetter';
import LetterTemplate from '@/models/LetterTemplate';
import { renderLetterContentHTML } from '@/lib/letterUtils';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    // Force model registration
    const models = [LetterTemplate];

    // In Next.js 15+, params is a Promise in Route Handlers
    const { id } = await params;
    const letter = await GeneratedLetter.findById(id)
      .populate('employeeId', 'name employeeId designation department email')
      .populate('templateId');
    
    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 });
    }

    // Cast employeeId to any since it's populated but typed as ObjectId
    const employee = letter.employeeId as any;
    const template = letter.templateId as any;

    // Check permissions
    const isAdmin = ['super_admin', 'admin', 'director', 'hr'].includes(session.user.role as string);
    const isOwner = employee._id.toString() === session.user.id;
    
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If template exists and has updated content, dynamically render using updated template content + saved variables
    let finalContent = letter.content;
    if (template && template.content) {
      const renderedBody = renderLetterContentHTML(template.content, employee, letter.variables, letter.createdAt);
      finalContent = `<div style="font-family: Arial, sans-serif; padding: 20px;">${renderedBody}</div>`;
    }

    if (!finalContent) {
      return NextResponse.json({ error: 'No content found for this letter' }, { status: 400 });
    }

    // Return HTML page triggering browser's native print
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Letter - ${employee.name || 'Employee'}</title>
          <style>
            @font-face {
              font-family: "Allura";
              src: url("/font/Allura/Allura-Regular.ttf") format("truetype");
            }
            body {
              background-color: #ffffff;
              font-size: 16px;
              text-align: justify;
              font-family: Helvetica, Arial, sans-serif;
              line-height: 1.5;
              margin: 0;
              padding: 20px;
            }
            @media print {
              @page {
                size: A4;
                margin: 0;
              }
            }
            div {
              padding-top: 20px;
              padding-right: 20px;
            }
          </style>
        </head>
        <body onload="setTimeout(() => window.print(), 500)">
          ${finalContent}
        </body>
      </html>
    `;

    const headers = new Headers();
    headers.set('Content-Type', 'text/html');

    return new NextResponse(html, { status: 200, headers });
  } catch (error: any) {
    console.error('PDF display error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

