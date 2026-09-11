import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const {
      casualLeave,
      casualLeaveTaken,
      sickLeave,
      sickLeaveTaken,
      restrictedLeave,
      restrictedLeaveTaken,
      compensatoryOff,
      compensatoryOffTaken,
      leaveWithoutPayTaken
    } = body;

    await dbConnect();

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.leaveBalance) {
      user.leaveBalance = {
        sickLeave: { total: 12, available: 12, taken: 0, withoutCertificate: { limit: 4, used: 0 }, withCertificate: { limit: 8, used: 0 } },
        casualLeave: { total: 0, available: 0, taken: 0, carryForward: 0 },
        compensatoryOff: { total: 0, available: 0, taken: 0, earned: 0 },
        restrictedLeave: { total: 2, available: 2, taken: 0 },
        maternityLeave: { total: user.gender === 'female' ? 60 : 0, available: user.gender === 'female' ? 60 : 0, taken: 0 },
        paternityLeave: { total: user.gender === 'male' ? 2 : 0, available: user.gender === 'male' ? 2 : 0, taken: 0 },
        leaveWithoutPay: { taken: 0 }
      };
    }

    // Casual Leave
    if (casualLeave !== undefined) user.leaveBalance.casualLeave.available = Number(casualLeave);
    if (casualLeaveTaken !== undefined) user.leaveBalance.casualLeave.taken = Number(casualLeaveTaken);
    if (user.leaveBalance.casualLeave) {
      user.leaveBalance.casualLeave.total = Math.max(
        user.leaveBalance.casualLeave.total || 0,
        (user.leaveBalance.casualLeave.available || 0) + (user.leaveBalance.casualLeave.taken || 0)
      );
    }

    // Sick Leave
    if (sickLeave !== undefined) user.leaveBalance.sickLeave.available = Number(sickLeave);
    if (sickLeaveTaken !== undefined) user.leaveBalance.sickLeave.taken = Number(sickLeaveTaken);
    if (user.leaveBalance.sickLeave) {
      user.leaveBalance.sickLeave.total = Math.max(
        user.leaveBalance.sickLeave.total || 0,
        (user.leaveBalance.sickLeave.available || 0) + (user.leaveBalance.sickLeave.taken || 0)
      );
    }

    // Restricted Leave
    if (restrictedLeave !== undefined) user.leaveBalance.restrictedLeave.available = Number(restrictedLeave);
    if (restrictedLeaveTaken !== undefined) user.leaveBalance.restrictedLeave.taken = Number(restrictedLeaveTaken);
    if (user.leaveBalance.restrictedLeave) {
      user.leaveBalance.restrictedLeave.total = Math.max(
        user.leaveBalance.restrictedLeave.total || 0,
        (user.leaveBalance.restrictedLeave.available || 0) + (user.leaveBalance.restrictedLeave.taken || 0)
      );
    }

    // Compensatory Off
    if (compensatoryOff !== undefined) user.leaveBalance.compensatoryOff.available = Number(compensatoryOff);
    if (compensatoryOffTaken !== undefined) user.leaveBalance.compensatoryOff.taken = Number(compensatoryOffTaken);
    if (user.leaveBalance.compensatoryOff) {
      user.leaveBalance.compensatoryOff.total = (user.leaveBalance.compensatoryOff.available || 0) + (user.leaveBalance.compensatoryOff.taken || 0);
    }

    // Leave Without Pay
    if (leaveWithoutPayTaken !== undefined) {
      if (!user.leaveBalance.leaveWithoutPay) {
        user.leaveBalance.leaveWithoutPay = { taken: 0 };
      }
      user.leaveBalance.leaveWithoutPay.taken = Number(leaveWithoutPayTaken);
    }

    user.markModified('leaveBalance');
    await user.save();

    return NextResponse.json({ message: 'Leave balance updated successfully', leaveBalance: user.leaveBalance });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
