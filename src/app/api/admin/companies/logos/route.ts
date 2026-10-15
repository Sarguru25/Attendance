import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || (!['admin', 'super_admin'].includes(session.user.role) && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const logoDir = path.join(process.cwd(), 'public', 'logo');
    let logos: { name: string; path: string; filename: string }[] = [];

    if (fs.existsSync(logoDir)) {
      const files = fs.readdirSync(logoDir);
      logos = files
        .filter((file) => /\.(png|jpe?g|svg|webp)$/i.test(file))
        .sort((a, b) => a.localeCompare(b))
        .map((file) => ({
          name: file.replace(/\.[^/.]+$/, ''),
          filename: file,
          path: `/logo/${file}`,
        }));
    }

    return NextResponse.json({ logos });
  } catch (error: any) {
    console.error('Error fetching logos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
