import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payroll from '@/models/Payroll';
import SystemAuditLog from '@/models/SystemAuditLog';
import { formatDateToYYYYMMDD, getSalaryForPayrollPeriod } from '@/lib/salaryUtils';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const session = await auth();
    if (!session || !['super_admin', 'company_admin', 'admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findById(params.id).select('name employeeId monthlySalary joiningDate salaryTimelines');
    if (!user) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    let timelines = user.salaryTimelines || [];
    
    // If no salary timeline array exists, fallback to baseline from monthlySalary & joiningDate
    if (timelines.length === 0 && user.monthlySalary > 0) {
      const fallbackEff = user.joiningDate ? formatDateToYYYYMMDD(user.joiningDate) : '2026-01-01';
      timelines = [{
        effectiveFrom: new Date(fallbackEff),
        monthlySalary: user.monthlySalary,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any];
    }

    // Sort ascending by effectiveFrom
    timelines.sort((a: any, b: any) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime());

    return NextResponse.json({ salaryTimelines: timelines }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const session = await auth();
    if (!session || !['super_admin', 'company_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { effectiveFrom, monthlySalary } = await req.json();

    // Rule 4: Salary > 0 validation
    const salaryNum = Number(monthlySalary);
    if (isNaN(salaryNum) || salaryNum <= 0) {
      return NextResponse.json({ error: 'Salary must be greater than zero' }, { status: 400 });
    }

    // Rule 2: Invalid date validation
    if (!effectiveFrom || isNaN(new Date(effectiveFrom).getTime())) {
      return NextResponse.json({ error: 'Invalid effective date' }, { status: 400 });
    }

    const effYMD = formatDateToYYYYMMDD(effectiveFrom);
    if (!effYMD) {
      return NextResponse.json({ error: 'Invalid effective date format' }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findById(params.id);
    if (!user) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (!user.salaryTimelines) {
      user.salaryTimelines = [];
    }

    // If existing salary exists but no timelines yet, migrate baseline first
    if (user.salaryTimelines.length === 0 && user.monthlySalary > 0) {
      const baselineDate = user.joiningDate ? formatDateToYYYYMMDD(user.joiningDate) : '2026-01-01';
      if (baselineDate !== effYMD) {
        user.salaryTimelines.push({
          effectiveFrom: new Date(baselineDate),
          monthlySalary: user.monthlySalary,
          createdAt: new Date(),
          updatedAt: new Date()
        } as any);
      }
    }

    // Rule 1: No duplicate effective dates validation
    const duplicate = user.salaryTimelines.find(
      t => formatDateToYYYYMMDD(t.effectiveFrom) === effYMD
    );

    if (duplicate) {
      return NextResponse.json(
        { error: `A salary timeline starting on ${effYMD} already exists` },
        { status: 400 }
      );
    }

    // Add new timeline
    const newTimeline = {
      effectiveFrom: new Date(`${effYMD}T00:00:00`),
      monthlySalary: salaryNum,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    user.salaryTimelines.push(newTimeline as any);

    // Rule 3: Sort automatically by effectiveFrom ASC
    user.salaryTimelines.sort((a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime());

    // Sync user.monthlySalary with current active timeline (or latest)
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const activeSalaryInfo = getSalaryForPayrollPeriod(user, currentMonth, currentYear);
    if (activeSalaryInfo) {
      user.monthlySalary = activeSalaryInfo.monthlySalary;

      // Sync ESI
      if (user.role === 'intern' || user.monthlySalary > 21000) {
        if (user.salaryDeductions?.esi) {
          user.salaryDeductions.esi.enabled = false;
          user.salaryDeductions.esi.amount = 0;
        }
      } else if (user.salaryDeductions?.esi?.enabled) {
        user.salaryDeductions.esi.amount = Math.round(user.monthlySalary * 0.0075);
      }
    }

    user.markModified('salaryTimelines');
    user.markModified('salaryDeductions');
    await user.save();

    // Audit logging
    await SystemAuditLog.create({
      userId: session.user.id,
      companyId: user.companyId || session.user.companyId,
      action: 'Salary Timeline Added',
      details: `Added salary timeline for ${user.name} (${user.employeeId}): ₹${salaryNum}/month effective from ${effYMD}`
    });

    return NextResponse.json({ message: 'Salary timeline added successfully', salaryTimelines: user.salaryTimelines }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const session = await auth();
    if (!session || !['super_admin', 'company_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { timelineId, effectiveFrom, monthlySalary } = await req.json();

    if (!timelineId) {
      return NextResponse.json({ error: 'Timeline ID is required' }, { status: 400 });
    }

    // Rule 4: Salary > 0
    const salaryNum = Number(monthlySalary);
    if (isNaN(salaryNum) || salaryNum <= 0) {
      return NextResponse.json({ error: 'Salary must be greater than zero' }, { status: 400 });
    }

    // Rule 2: Invalid date
    if (!effectiveFrom || isNaN(new Date(effectiveFrom).getTime())) {
      return NextResponse.json({ error: 'Invalid effective date' }, { status: 400 });
    }

    const effYMD = formatDateToYYYYMMDD(effectiveFrom);
    if (!effYMD) {
      return NextResponse.json({ error: 'Invalid effective date format' }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findById(params.id);
    if (!user) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (!user.salaryTimelines || user.salaryTimelines.length === 0) {
      return NextResponse.json({ error: 'No salary timelines found for employee' }, { status: 404 });
    }

    // Rule 1: No duplicate effective date (excluding current item)
    const duplicate = user.salaryTimelines.find(
      t => (t as any)._id?.toString() !== timelineId && formatDateToYYYYMMDD(t.effectiveFrom) === effYMD
    );

    if (duplicate) {
      return NextResponse.json(
        { error: `Another salary timeline starting on ${effYMD} already exists` },
        { status: 400 }
      );
    }

    const timelineIndex = user.salaryTimelines.findIndex(
      t => (t as any)._id?.toString() === timelineId
    );

    if (timelineIndex === -1) {
      return NextResponse.json({ error: 'Salary timeline entry not found' }, { status: 404 });
    }

    const prevSalary = user.salaryTimelines[timelineIndex].monthlySalary;
    user.salaryTimelines[timelineIndex].effectiveFrom = new Date(`${effYMD}T00:00:00`);
    user.salaryTimelines[timelineIndex].monthlySalary = salaryNum;
    user.salaryTimelines[timelineIndex].updatedAt = new Date();

    // Rule 3: Sort automatically by effectiveFrom ASC
    user.salaryTimelines.sort((a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime());

    // Sync user.monthlySalary with active timeline
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const activeSalaryInfo = getSalaryForPayrollPeriod(user, currentMonth, currentYear);
    if (activeSalaryInfo) {
      user.monthlySalary = activeSalaryInfo.monthlySalary;

      if (user.role === 'intern' || user.monthlySalary > 21000) {
        if (user.salaryDeductions?.esi) {
          user.salaryDeductions.esi.enabled = false;
          user.salaryDeductions.esi.amount = 0;
        }
      } else if (user.salaryDeductions?.esi?.enabled) {
        user.salaryDeductions.esi.amount = Math.round(user.monthlySalary * 0.0075);
      }
    }

    user.markModified('salaryTimelines');
    user.markModified('salaryDeductions');
    await user.save();

    // Audit logging
    await SystemAuditLog.create({
      userId: session.user.id,
      companyId: user.companyId || session.user.companyId,
      action: 'Salary Timeline Updated',
      details: `Updated salary timeline for ${user.name} (${user.employeeId}): previous ₹${prevSalary}, new ₹${salaryNum}/month effective from ${effYMD}`
    });

    return NextResponse.json({ message: 'Salary timeline updated successfully', salaryTimelines: user.salaryTimelines }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const session = await auth();
    if (!session || !['super_admin', 'company_admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let timelineId = searchParams.get('timelineId');

    if (!timelineId) {
      const body = await req.json().catch(() => ({}));
      timelineId = body.timelineId;
    }

    if (!timelineId) {
      return NextResponse.json({ error: 'Timeline ID is required' }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findById(params.id);
    if (!user) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const timelineToDelete = user.salaryTimelines?.find(
      t => (t as any)._id?.toString() === timelineId
    );

    if (!timelineToDelete) {
      return NextResponse.json({ error: 'Salary timeline entry not found' }, { status: 404 });
    }

    const targetEffYMD = formatDateToYYYYMMDD(timelineToDelete.effectiveFrom);

    // Rule: Check if timeline is safe to delete
    // Check if any finalized Payroll record exists for this employee where this timeline was effective
    const userPayrolls = await Payroll.find({ userId: user._id });
    for (const payroll of userPayrolls) {
      if (payroll.salaryTimelineEffectiveFrom) {
        const payrollEffYMD = formatDateToYYYYMMDD(payroll.salaryTimelineEffectiveFrom);
        if (payrollEffYMD === targetEffYMD) {
          return NextResponse.json(
            { error: `Cannot delete salary timeline effective ${targetEffYMD} because it is used by a generated payroll (${payroll.month}/${payroll.year}).` },
            { status: 400 }
          );
        }
      }
    }

    // Remove timeline
    user.salaryTimelines = user.salaryTimelines?.filter(
      t => (t as any)._id?.toString() !== timelineId
    );

    // Sort remaining
    user.salaryTimelines?.sort((a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime());

    // Sync user.monthlySalary
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const activeSalaryInfo = getSalaryForPayrollPeriod(user, currentMonth, currentYear);
    if (activeSalaryInfo) {
      user.monthlySalary = activeSalaryInfo.monthlySalary;
    }

    user.markModified('salaryTimelines');
    await user.save();

    // Audit logging
    await SystemAuditLog.create({
      userId: session.user.id,
      companyId: user.companyId || session.user.companyId,
      action: 'Salary Timeline Deleted',
      details: `Deleted salary timeline for ${user.name} (${user.employeeId}) effective from ${targetEffYMD}`
    });

    return NextResponse.json({ message: 'Salary timeline deleted successfully', salaryTimelines: user.salaryTimelines }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
