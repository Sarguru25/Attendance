import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import GeneratedLetter from '@/models/GeneratedLetter';
import LetterTemplate from '@/models/LetterTemplate';
import User from '@/models/User';
import { renderLetterContentHTML } from '@/lib/letterUtils';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    // Allow 'employee' to view their own letters
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    // Force model registration to prevent Next.js tree shaking from dropping them
    const models = [LetterTemplate, User, GeneratedLetter];
    
    const rawLetters = await GeneratedLetter.find({ employeeId: session.user.id })
      .populate('templateId', 'templateName category content subject customVariables')
      .populate('employeeId', 'name employeeId designation department email')
      .sort({ createdAt: -1 });

    const letters = rawLetters.map((doc: any) => {
      const letterObj = doc.toObject();
      let dynamicContent = letterObj.content;
      if (letterObj.templateId && letterObj.templateId.content) {
        const rendered = renderLetterContentHTML(
          letterObj.templateId.content,
          letterObj.employeeId,
          letterObj.variables,
          letterObj.createdAt
        );
        dynamicContent = `<div style="font-family: Arial, sans-serif; padding: 20px;">${rendered}</div>`;
      }
      return {
        ...letterObj,
        content: dynamicContent,
      };
    });

    return NextResponse.json({ letters }, { status: 200 });
  } catch (error: any) {
    console.error('API Error in /api/employee/letters:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

