import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Shift from '@/models/Shift';

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    let shifts = await Shift.find({ isActive: true });
    
    if (shifts.length === 0) {
      await Shift.create([
        { 
          shiftName: 'General Shift', 
          sessions: [
            { order: 1, startTime: '07:30', endTime: '16:30', graceTime: 15 }
          ],
          firstHalf: { startTime: '07:30', endTime: '12:00' },
          secondHalf: { startTime: '12:00', endTime: '16:30' },
          workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        },
        { 
          shiftName: 'Regular Shift', 
          sessions: [
            { order: 1, startTime: '09:00', endTime: '18:00', graceTime: 15 }
          ],
          firstHalf: { startTime: '09:00', endTime: '13:30' },
          secondHalf: { startTime: '13:30', endTime: '18:00' },
          workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        }
      ]);
      shifts = await Shift.find({ isActive: true });
    }
    return NextResponse.json({ shifts });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { shiftName, workingDays, sessions, firstHalf, secondHalf } = await req.json();

    if (!shiftName || !workingDays || workingDays.length === 0 || !sessions || sessions.length === 0) {
      return NextResponse.json({ error: 'Missing required fields or sessions' }, { status: 400 });
    }

    sessions.sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));

    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      if (s.endTime <= s.startTime) {
        return NextResponse.json({ error: `Session ${i+1}: End time must be after start time` }, { status: 400 });
      }
      s.order = i + 1;
      s.graceTime = s.graceTime || 0;

      if (i > 0) {
        const prev = sessions[i - 1];
        if (s.startTime < prev.endTime) {
          return NextResponse.json({ error: `Session ${i+1} overlaps with Session ${i}` }, { status: 400 });
        }
      }
    }

    await dbConnect();
    
    const shift = await Shift.create({
      shiftName,
      workingDays,
      sessions,
      firstHalf: firstHalf || {
        startTime: sessions[0]?.startTime || '09:00',
        endTime: sessions[0]?.endTime || '13:30'
      },
      secondHalf: secondHalf || {
        startTime: sessions[1]?.startTime || '13:30',
        endTime: sessions[sessions.length - 1]?.endTime || '18:00'
      },
      startTime: sessions[0].startTime,
      endTime: sessions[sessions.length - 1].endTime,
      graceTime: sessions[0].graceTime
    });

    return NextResponse.json({ message: 'Shift created successfully', shift }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
