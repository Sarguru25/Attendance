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
    if (!session?.user || !['super_admin', 'admin', 'director', 'hr'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Force model registration to prevent Next.js tree shaking
    const models = [LetterTemplate, User, GeneratedLetter];

    const rawHistory = await GeneratedLetter.find()
      .populate('employeeId', 'name email employeeId designation department')
      .populate('templateId', 'templateName subject category content')
      .sort({ createdAt: -1 });

    const history = rawHistory.map((doc: any) => {
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

    return NextResponse.json({ history }, { status: 200 });
  } catch (error: any) {
    console.error('API Error in /api/letters/history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

