import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Shift from '@/models/Shift';

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { shiftName, workingDays, sessions, firstHalf, secondHalf, isActive } = await req.json();

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
    const { id } = await props.params;
    
    const shift = await Shift.findByIdAndUpdate(
      id,
      { 
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
        isActive,
        startTime: sessions[0].startTime,
        endTime: sessions[sessions.length - 1].endTime,
        graceTime: sessions[0].graceTime
      },
      { new: true }
    );

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Shift updated successfully', shift });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const { id } = await props.params;
    
    const shift = await Shift.findByIdAndDelete(id);

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Shift deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
