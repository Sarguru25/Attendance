/**
 * Reusable utility for calculating working days and weekly offs based on shift configuration.
 * Supports recurring working-day rules, dynamic Saturday rules (e.g. 2nd Saturday only),
 * Sunday working toggles, and provides backward compatibility for legacy shifts.
 */

export type SaturdayRule =
  | 'ALL_SATURDAYS_WORKING'
  | 'SECOND_SATURDAY_ONLY'
  | 'FIRST_THIRD_SATURDAYS'
  | 'ALTERNATE_SATURDAYS'
  | 'ALL_SATURDAYS_OFF'
  | 'CUSTOM';

export interface IWorkingDayConfig {
  regularWorkingDays: string[]; // e.g. ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
  saturdayRule: SaturdayRule;
  sundayWorking: boolean;
  customSaturdays?: number[]; // [1..5], e.g. [2] for 2nd Saturday
}

export const WEEKDAY_NAMES = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY'
] as const;

export const DEFAULT_REGULAR_WORKING_DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY'
];

export const SATURDAY_RULE_OPTIONS: {
  value: SaturdayRule;
  label: string;
  description: string;
}[] = [
  {
    value: 'SECOND_SATURDAY_ONLY',
    label: 'Second Saturday Only',
    description: '2nd Saturday is working; 1st, 3rd, 4th, 5th are weekly offs'
  },
  {
    value: 'ALL_SATURDAYS_WORKING',
    label: 'All Saturdays Working',
    description: 'Every Saturday is a working day'
  },
  {
    value: 'FIRST_THIRD_SATURDAYS',
    label: 'First & Third Saturdays Working',
    description: '1st and 3rd Saturdays are working; 2nd, 4th, 5th are weekly offs'
  },
  {
    value: 'ALTERNATE_SATURDAYS',
    label: 'Alternate Saturdays (1st, 3rd, 5th)',
    description: '1st, 3rd, and 5th Saturdays are working; 2nd and 4th are weekly offs'
  },
  {
    value: 'ALL_SATURDAYS_OFF',
    label: 'All Saturdays Off',
    description: 'Every Saturday is a weekly off'
  },
  {
    value: 'CUSTOM',
    label: 'Custom Saturday Rules',
    description: 'Manually choose which Saturdays (1st to 5th) are working'
  }
];

export function getDefaultWorkingDayConfig(): IWorkingDayConfig {
  return {
    regularWorkingDays: [...DEFAULT_REGULAR_WORKING_DAYS],
    saturdayRule: 'ALL_SATURDAYS_OFF',
    sundayWorking: false,
    customSaturdays: []
  };
}

export interface DateDetails {
  year: number;
  month: number; // 0-indexed (0 = Jan, 11 = Dec)
  dayOfMonth: number; // 1-31
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  weekdayName: string; // "SUNDAY", "MONDAY", etc.
}

/**
 * Parses date safely avoiding timezone shifting issues.
 */
export function parseDateDetails(
  date: Date | string,
  options?: { useUTC?: boolean }
): DateDetails {
  if (typeof date === 'string') {
    // Check YYYY-MM-DD pattern
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const dayOfMonth = parseInt(match[3], 10);
      // Create a noon UTC date to avoid any boundary shifts
      const utcDate = new Date(Date.UTC(year, month, dayOfMonth, 12, 0, 0));
      const dayOfWeek = utcDate.getUTCDay();
      return {
        year,
        month,
        dayOfMonth,
        dayOfWeek,
        weekdayName: WEEKDAY_NAMES[dayOfWeek]
      };
    }
    date = new Date(date);
  }

  const isExplicitUTC = options?.useUTC === true;
  const isAutoUTC =
    options?.useUTC === undefined &&
    date instanceof Date &&
    !isNaN(date.getTime()) &&
    date.toISOString().endsWith('T00:00:00.000Z');

  if (isExplicitUTC || isAutoUTC) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const dayOfMonth = date.getUTCDate();
    const dayOfWeek = date.getUTCDay();
    return {
      year,
      month,
      dayOfMonth,
      dayOfWeek,
      weekdayName: WEEKDAY_NAMES[dayOfWeek]
    };
  }

  const year = date.getFullYear();
  const month = date.getMonth();
  const dayOfMonth = date.getDate();
  const dayOfWeek = date.getDay();
  return {
    year,
    month,
    dayOfMonth,
    dayOfWeek,
    weekdayName: WEEKDAY_NAMES[dayOfWeek]
  };
}

/**
 * Returns which Saturday of the month this date is (1st, 2nd, 3rd, 4th, or 5th).
 */
export function getSaturdayOccurrence(
  date: Date | string,
  options?: { useUTC?: boolean }
): number {
  const details = parseDateDetails(date, options);
  return Math.ceil(details.dayOfMonth / 7);
}

export type ShiftLike =
  | {
      workingDayConfig?: IWorkingDayConfig | null;
      workingDays?: string[] | null;
      saturdayRule?: SaturdayRule;
      sundayWorking?: boolean;
      customSaturdays?: number[];
      regularWorkingDays?: string[];
    }
  | null
  | undefined;

/**
 * Determines whether a given date is a working day based on the shift configuration.
 *
 * Rules:
 * - Regular weekdays (Monday - Friday) are working days if present in regularWorkingDays.
 * - Saturday is checked against saturdayRule (e.g. SECOND_SATURDAY_ONLY).
 * - Sunday is checked against sundayWorking (weekly off by default).
 * - Fully backwards compatible with legacy shift documents having workingDays: string[].
 */
export function isWorkingDay(
  date: Date | string,
  shiftOrConfig?: ShiftLike,
  options?: { useUTC?: boolean }
): boolean {
  if (!date) return true;

  const details = parseDateDetails(date, options);
  const { dayOfWeek, dayOfMonth, weekdayName } = details;

  // Extract config
  const config: IWorkingDayConfig | undefined =
    shiftOrConfig?.workingDayConfig ||
    (shiftOrConfig?.saturdayRule ? (shiftOrConfig as unknown as IWorkingDayConfig) : undefined);

  if (config) {
    // 1. Sunday check
    if (dayOfWeek === 0) {
      if (config.sundayWorking === true) return true;
      const normalizedReg = (config.regularWorkingDays || []).map((d: string) => d.toUpperCase());
      return normalizedReg.includes('SUNDAY');
    }

    // 2. Saturday check
    if (dayOfWeek === 6) {
      const occurrence = Math.ceil(dayOfMonth / 7);

      if (Array.isArray(config.customSaturdays)) {
        return config.customSaturdays.includes(occurrence);
      }

      const rule = config.saturdayRule || 'SECOND_SATURDAY_ONLY';
      switch (rule) {
        case 'ALL_SATURDAYS_WORKING':
          return true;
        case 'ALL_SATURDAYS_OFF':
          return false;
        case 'SECOND_SATURDAY_ONLY':
          return occurrence === 2;
        case 'FIRST_THIRD_SATURDAYS':
          return occurrence === 1 || occurrence === 3;
        case 'ALTERNATE_SATURDAYS':
          return occurrence === 1 || occurrence === 3 || occurrence === 5;
        case 'CUSTOM':
          return occurrence === 2;
        default:
          return occurrence === 2;
      }
    }

    // 3. Regular weekday check (Monday - Friday)
    const normalizedReg = (
      config.regularWorkingDays || DEFAULT_REGULAR_WORKING_DAYS
    ).map((d: string) => d.toUpperCase());
    return normalizedReg.includes(weekdayName);
  }

  // Legacy fallback if workingDayConfig is missing
  if (
    shiftOrConfig &&
    Array.isArray(shiftOrConfig.workingDays) &&
    shiftOrConfig.workingDays.length > 0
  ) {
    const legacyDays = shiftOrConfig.workingDays.map((d: string) => d.toLowerCase());
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return legacyDays.includes(dayNames[dayOfWeek]);
  }

  // Safe system default: Mon-Fri working, Sat-Sun off
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}

/**
 * Determines whether a given date is a weekly off based on the shift configuration.
 */
export function isWeeklyOff(
  date: Date | string,
  shiftOrConfig?: ShiftLike,
  options?: { useUTC?: boolean }
): boolean {
  return !isWorkingDay(date, shiftOrConfig, options);
}

export interface DayPreview {
  dayNumber: number;
  date: Date;
  dateStr: string;
  dayOfWeek: number; // 0 = Sun, 6 = Sat
  dayName: string;
  isWorkingDay: boolean;
  isWeeklyOff: boolean;
  isSaturday: boolean;
  saturdayOccurrence?: number;
  isSunday: boolean;
}

/**
 * Generates day-by-day preview items for a given calendar month and year.
 * month is 1-indexed (1 = January, 12 = December).
 */
export function getMonthCalendarPreview(
  year: number,
  month: number,
  config: IWorkingDayConfig
): DayPreview[] {
  const totalDays = new Date(year, month, 0).getDate();
  const days: DayPreview[] = [];

  for (let d = 1; d <= totalDays; d++) {
    // Create local date
    const date = new Date(year, month - 1, d);
    const dayOfWeek = date.getDay();
    const isSat = dayOfWeek === 6;
    const isSun = dayOfWeek === 0;
    const satOccurrence = isSat ? Math.ceil(d / 7) : undefined;
    const working = isWorkingDay(date, { workingDayConfig: config }, { useUTC: false });

    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(d).padStart(2, '0');
    const dateStr = `${year}-${monthStr}-${dayStr}`;

    days.push({
      dayNumber: d,
      date,
      dateStr,
      dayOfWeek,
      dayName: WEEKDAY_NAMES[dayOfWeek],
      isWorkingDay: working,
      isWeeklyOff: !working,
      isSaturday: isSat,
      saturdayOccurrence: satOccurrence,
      isSunday: isSun
    });
  }

  return days;
}

/**
 * Summary count of working days and weekly offs in a given month.
 */
export function getWorkingDaysSummary(
  year: number,
  month: number,
  config: IWorkingDayConfig
): { totalDays: number; workingDays: number; weeklyOffs: number } {
  const days = getMonthCalendarPreview(year, month, config);
  const workingDays = days.filter(d => d.isWorkingDay).length;
  const weeklyOffs = days.filter(d => d.isWeeklyOff).length;
  return {
    totalDays: days.length,
    workingDays,
    weeklyOffs
  };
}

/**
 * Generates an array of weekday strings (Title Case) for backward compatibility
 * with legacy systems that expect shift.workingDays.
 */
export function ensureWorkingDaysArray(config: IWorkingDayConfig): string[] {
  const dayNameMap: Record<string, string> = {
    MONDAY: 'Monday',
    TUESDAY: 'Tuesday',
    WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday',
    FRIDAY: 'Friday',
    SATURDAY: 'Saturday',
    SUNDAY: 'Sunday'
  };

  const days: string[] = [];

  // Add regular working days
  for (const reg of config.regularWorkingDays || DEFAULT_REGULAR_WORKING_DAYS) {
    const formatted = dayNameMap[reg.toUpperCase()];
    if (formatted && !days.includes(formatted)) {
      days.push(formatted);
    }
  }

  // Include Saturday if customSaturdays has any entries or saturdayRule permits
  const hasWorkingSaturday = Array.isArray(config.customSaturdays)
    ? config.customSaturdays.length > 0
    : Boolean(config.saturdayRule && config.saturdayRule !== 'ALL_SATURDAYS_OFF');

  if (hasWorkingSaturday && !days.includes('Saturday')) {
    days.push('Saturday');
  }

  // Include Sunday if sundayWorking is true
  if (config.sundayWorking && !days.includes('Sunday')) {
    days.push('Sunday');
  }

  return days;
}

/**
 * Human-readable description of shift working schedule.
 */
export function formatShiftWorkingDays(shift: ShiftLike): string {
  if (!shift) return 'N/A';

  const config = shift.workingDayConfig;
  if (!config) {
    if (Array.isArray(shift.workingDays) && shift.workingDays.length > 0) {
      return shift.workingDays.map((d: string) => d.slice(0, 3)).join(', ');
    }
    return 'Mon-Fri';
  }

  const reg = (config.regularWorkingDays || DEFAULT_REGULAR_WORKING_DAYS).map((d: string) => d.toUpperCase());
  const isStandardMonFri =
    reg.length === 5 &&
    ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].every(d => reg.includes(d));

  let base = isStandardMonFri ? 'Mon-Fri' : reg.map((d: string) => d.slice(0, 3)).join(', ');

  let satSuffix = '';
  if (Array.isArray(config.customSaturdays)) {
    const list = [...config.customSaturdays].sort((a, b) => a - b);
    if (list.length === 5) {
      satSuffix = isStandardMonFri ? 'Mon-Sat' : ' + All Sat';
      if (isStandardMonFri) base = 'Mon-Sat';
    } else if (list.length === 0) {
      satSuffix = '';
    } else if (list.length === 1 && list[0] === 2) {
      satSuffix = ' + 2nd Sat';
    } else if (list.length === 2 && list[0] === 1 && list[1] === 3) {
      satSuffix = ' + 1st, 3rd Sat';
    } else {
      const ords: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' };
      satSuffix = ` + ${list.map(n => ords[n] || `${n}th`).join(', ')} Sat`;
    }
  } else {
    switch (config.saturdayRule) {
      case 'SECOND_SATURDAY_ONLY':
        satSuffix = ' + 2nd Sat';
        break;
      case 'ALL_SATURDAYS_WORKING':
        satSuffix = isStandardMonFri ? 'Mon-Sat' : ' + All Sat';
        if (isStandardMonFri) base = 'Mon-Sat';
        break;
      case 'FIRST_THIRD_SATURDAYS':
        satSuffix = ' + 1st, 3rd Sat';
        break;
      case 'ALTERNATE_SATURDAYS':
        satSuffix = ' + Alt Sat';
        break;
      case 'CUSTOM':
      case 'ALL_SATURDAYS_OFF':
      default:
        satSuffix = '';
        break;
    }
  }

  const sunSuffix = config.sundayWorking ? ' + Sun' : '';

  if (base === 'Mon-Sat' && !config.sundayWorking) {
    return 'Mon-Sat';
  }

  return `${base}${satSuffix === 'Mon-Sat' ? '' : satSuffix}${sunSuffix}`;
}
