import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import Leave from '@/models/Leave';
import User from '@/models/User';
import Notification from '@/models/Notification';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leaveType, fromDate, toDate, reason, attachments, duration = 'full_day', halfDaySession } = await req.json();
    const finalHalfDaySession = (halfDaySession === '' || !halfDaySession) ? null : halfDaySession;

    // Calculate number of days
    const start = new Date(fromDate);
    const end = new Date(toDate);
    let numberOfDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (numberOfDays <= 0) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
    }

    if (duration === 'half_day') {
      if (numberOfDays !== 1) {
        return NextResponse.json({ error: 'Half day leave must be for a single date' }, { status: 400 });
      }
      if (!finalHalfDaySession) {
        return NextResponse.json({ error: 'Session (First Half / Second Half) is required for half day leave' }, { status: 400 });
      }
      numberOfDays = 0.5;
    }

    await dbConnect();

    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 1. Check Leave Policy allowHalfDay flag
    if (duration === 'half_day') {
      const LeavePolicy = (await import('@/models/LeavePolicy')).default;
      const policy = await LeavePolicy.findOne({
        $or: [
          { leaveType: leaveType, companyId: user.companyId },
          { name: leaveType, companyId: user.companyId },
          { leaveType: leaveType },
          { name: leaveType }
        ]
      });

      if (policy && policy.allowHalfDay === false) {
        return NextResponse.json({ error: `Half-day leaves are not permitted for ${leaveType}.` }, { status: 400 });
      }
    }

    // 2. Check Holiday or Rest Day
    const Holiday = (await import('@/models/Holiday')).default;
    const isHoliday = await Holiday.exists({
      date: { $gte: start, $lte: end },
      holidayType: { $in: ['public', 'company'] }
    });
    if (isHoliday) {
      return NextResponse.json({ error: 'Cannot apply for leave on a Public or Company Holiday.' }, { status: 400 });
    }

    // 3. Check for overlapping leaves
    const overlappingLeave = await Leave.findOne({
      userId: session.user.id,
      status: { $in: ['pending', 'approved'] },
      $or: [
        { fromDate: { $lte: end }, toDate: { $gte: start } }
      ]
    });

    if (overlappingLeave) {
      if (duration === 'half_day' && overlappingLeave.duration === 'half_day') {
        if (overlappingLeave.halfDaySession === finalHalfDaySession) {
          return NextResponse.json({ error: `You already have a leave request for the ${finalHalfDaySession === 'first_half' ? 'First Half' : 'Second Half'} on this date.` }, { status: 400 });
        } else {
          return NextResponse.json({ error: 'You cannot apply for First Half and Second Half separately. Please apply for a full day leave instead.' }, { status: 400 });
        }
      }
      return NextResponse.json({ error: 'You already have a pending or approved leave during this period.' }, { status: 400 });
    }

    const { LeaveBalanceEngine } = await import('@/services/LeaveBalanceEngine');
    
    const eligibility = await LeaveBalanceEngine.checkEligibility(session.user.id, leaveType, numberOfDays);

    if (!eligibility.eligible) {
      return NextResponse.json({ error: eligibility.reason }, { status: 400 });
    }

    if (leaveType === 'Restricted Holiday') {
      const Holiday = (await import('@/models/Holiday')).default;
      
      // We need to check if every day in the range is a restricted holiday
      const days = [];
      let currentDate = new Date(start);
      while (currentDate <= end) {
        days.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      for (const day of days) {
        const isRH = await Holiday.exists({
          date: day,
          holidayType: 'restricted'
        });
        if (!isRH) {
          const dateStr = day.toISOString().split('T')[0];
          return NextResponse.json({ error: `You can only apply for Restricted Holiday on designated restricted holidays. ${dateStr} is not a Restricted Holiday.` }, { status: 400 });
        }
      }
    }

    if (eligibility.requiresDocument && (!attachments || attachments.length === 0)) {
      return NextResponse.json({ error: 'Supporting documents are required for this leave type.' }, { status: 400 });
    }

    let currentApprover = user?.reportsTo;

    // If there's no manager, try to find an admin to be the current approver
    if (!currentApprover) {
      const admin = await User.findOne({ role: 'admin' });
      if (admin) currentApprover = admin._id;
    }
    
    let initialStatus = 'pending';

    const leave = await Leave.create({
      userId: session.user.id,
      leaveType,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      numberOfDays,
      duration,
      halfDaySession: finalHalfDaySession,
      attachments,
      reason,
      status: initialStatus as any,
      currentApprover: currentApprover || undefined,
    });

    if (currentApprover) {
      let leaveDesc = 'leave';
      if (duration === 'half_day') {
         leaveDesc = finalHalfDaySession === 'first_half' ? 'First Half Leave' : 'Second Half Leave';
      }

      await Notification.create({
        recipientId: currentApprover,
        type: 'LEAVE_REQUEST',
        message: `${user?.name} has applied for ${leaveDesc} and requires your approval.`,
        link: user?.role === 'employee' ? '/employee/leaves' : '/admin/leaves',
      });
    }

    return NextResponse.json({ message: 'Leave applied successfully', leave }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
