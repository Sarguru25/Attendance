import { format, subDays } from 'date-fns';

export interface ISalaryTimeline {
  _id?: any;
  effectiveFrom: Date | string;
  monthlySalary: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ITimelineDisplayItem {
  _id?: string;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveFromFormatted: string; // e.g. 01-Mar-2026
  effectiveTo: string; // YYYY-MM-DD or 'Present'
  effectiveToFormatted: string; // e.g. 31-Aug-2026 or Present
  monthlySalary: number;
  status: 'Historical' | 'Current' | 'Future';
}

/**
 * Normalizes a date to YYYY-MM-DD string format
 */
export function formatDateToYYYYMMDD(dateVal: Date | string): string {
  if (!dateVal) return '';
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
    return dateVal;
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return format(d, 'yyyy-MM-dd');
}

/**
 * Formats YYYY-MM-DD date to dd-MMM-yyyy format for UI display (e.g. 01-Mar-2026)
 */
export function formatDateDisplay(dateVal: Date | string): string {
  const ymd = formatDateToYYYYMMDD(dateVal);
  if (!ymd) return '';
  const d = new Date(`${ymd}T00:00:00`);
  return format(d, 'dd-MMM-yyyy');
}

/**
 * Computes sorted timeline items with calculated Effective To dates and Status badges for UI display.
 */
export function computeTimelineDisplayList(
  timelines: ISalaryTimeline[],
  referenceDate: Date = new Date()
): ITimelineDisplayItem[] {
  if (!timelines || timelines.length === 0) return [];

  // Sort ASC by effectiveFrom
  const sorted = [...timelines].sort((a, b) => {
    const timeA = new Date(a.effectiveFrom).getTime();
    const timeB = new Date(b.effectiveFrom).getTime();
    return timeA - timeB;
  });

  const refYMD = formatDateToYYYYMMDD(referenceDate);

  return sorted.map((item, index) => {
    const effFromYMD = formatDateToYYYYMMDD(item.effectiveFrom);
    const effFromFormatted = formatDateDisplay(item.effectiveFrom);

    let effToYMD = 'Present';
    let effToFormatted = 'Present';

    if (index < sorted.length - 1) {
      const nextEffFromYMD = formatDateToYYYYMMDD(sorted[index + 1].effectiveFrom);
      const nextDate = new Date(`${nextEffFromYMD}T00:00:00`);
      const prevDate = subDays(nextDate, 1);
      effToYMD = format(prevDate, 'yyyy-MM-dd');
      effToFormatted = format(prevDate, 'dd-MMM-yyyy');
    }

    let status: 'Historical' | 'Current' | 'Future' = 'Historical';
    if (effFromYMD > refYMD) {
      status = 'Future';
    } else if (effToYMD === 'Present' || effToYMD >= refYMD) {
      status = 'Current';
    } else {
      status = 'Historical';
    }

    return {
      _id: item._id?.toString(),
      effectiveFrom: effFromYMD,
      effectiveFromFormatted: effFromFormatted,
      effectiveTo: effToYMD,
      effectiveToFormatted: effToFormatted,
      monthlySalary: item.monthlySalary,
      status,
    };
  });
}

/**
 * Gets the applicable salary timeline and monthly salary for a given employee and payroll period (month, year).
 * Selects the timeline with the latest effectiveFrom date that is on or before the end of the payroll month.
 */
export function getSalaryForPayrollPeriod(
  employee: {
    salaryTimelines?: ISalaryTimeline[];
    monthlySalary?: number;
    joiningDate?: Date | string;
  },
  month: number, // 1-12
  year: number
): { monthlySalary: number; effectiveFrom?: Date | string; timeline?: ISalaryTimeline } | null {
  const timelines = employee.salaryTimelines || [];

  // End of payroll month format 'YYYY-MM-DD'
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const monthStr = String(month).padStart(2, '0');
  const lastDayStr = String(lastDayOfMonth).padStart(2, '0');
  const payrollPeriodEndStr = `${year}-${monthStr}-${lastDayStr}`;

  if (timelines.length > 0) {
    // Filter timelines where effectiveFrom <= payrollPeriodEnd
    const validTimelines = timelines.filter(t => {
      const effDateStr = formatDateToYYYYMMDD(t.effectiveFrom);
      return effDateStr && effDateStr <= payrollPeriodEndStr;
    });

    if (validTimelines.length === 0) {
      // Fall back to earliest configured timeline if employee was employed
      const sortedASC = [...timelines].sort((a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime());
      const earliest = sortedASC[0];
      if (earliest && earliest.monthlySalary > 0) {
        return {
          monthlySalary: earliest.monthlySalary,
          effectiveFrom: earliest.effectiveFrom,
          timeline: earliest
        };
      }
    } else {
      // Sort DESC to get latest active timeline on or before payroll period
      validTimelines.sort((a, b) => {
        const dateA = new Date(a.effectiveFrom).getTime();
        const dateB = new Date(b.effectiveFrom).getTime();
        return dateB - dateA;
      });

      const activeTimeline = validTimelines[0];
      return {
        monthlySalary: activeTimeline.monthlySalary,
        effectiveFrom: activeTimeline.effectiveFrom,
        timeline: activeTimeline
      };
    }
  }

  // Fallback for existing employees without salaryTimelines array
  if (typeof employee.monthlySalary === 'number' && employee.monthlySalary > 0) {
    return {
      monthlySalary: employee.monthlySalary,
      effectiveFrom: employee.joiningDate || undefined
    };
  }

  return null;
}
