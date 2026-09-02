import { IShiftSession } from '@/models/Shift';
import { IAttendanceSession } from '@/models/Attendance';
import { calculateHalfSession } from './halfDayUtils';

export function getActiveSessionInfo(
  sessions: IShiftSession[],
  attendanceSessions: IAttendanceSession[],
  currentTimeStr: string, // "HH:mm"
  approvedLeave?: any,
  shift?: any
) {
  if (!sessions || sessions.length === 0) {
    return {
      activeSession: null,
      nextSession: null,
      currentStatus: 'NO_SHIFT',
    };
  }

  const sortedSessions = [...sessions].sort((a, b) => a.order - b.order);
  const boundaries = calculateHalfSession(shift || { sessions: sortedSessions });
  const secondHalfStart = boundaries.secondHalf.start;

  // 1. Check Full Day Leave
  if (approvedLeave && (approvedLeave.duration === 'full_day' || !approvedLeave.halfDaySession)) {
    return {
      activeSession: null,
      nextSession: null,
      currentStatus: 'FULL_DAY_LEAVE',
      secondHalfStart
    };
  }

  // 2. Check First Half Leave
  if (approvedLeave && approvedLeave.duration === 'half_day' && approvedLeave.halfDaySession === 'first_half') {
    if (currentTimeStr < secondHalfStart) {
      return {
        activeSession: null,
        nextSession: sortedSessions[1] || sortedSessions[0] || null,
        currentStatus: 'FIRST_HALF_LEAVE',
        secondHalfStart
      };
    } else {
      // Time is >= secondHalfStart! Check if second half check-in/out is done
      const secondHalfAtt = attendanceSessions.find(a => a.sessionOrder === 2) || (attendanceSessions.length === 1 && attendanceSessions[0].checkIn ? attendanceSessions[0] : null);
      
      if (!secondHalfAtt || !secondHalfAtt.checkIn) {
        const activeSess = sortedSessions[1] || {
          order: 2,
          startTime: secondHalfStart,
          endTime: boundaries.secondHalf.end,
          graceTime: 0
        };
        return {
          activeSession: activeSess,
          nextSession: null,
          currentStatus: 'CAN_CHECK_IN',
          sessionState: null,
          secondHalfStart
        };
      } else if (secondHalfAtt.checkIn && !secondHalfAtt.checkOut) {
        const activeSess = sortedSessions[1] || {
          order: 2,
          startTime: secondHalfStart,
          endTime: boundaries.secondHalf.end,
          graceTime: 0
        };
        return {
          activeSession: activeSess,
          nextSession: null,
          currentStatus: 'CAN_CHECK_OUT',
          sessionState: secondHalfAtt,
          secondHalfStart
        };
      } else {
        return {
          activeSession: null,
          nextSession: null,
          currentStatus: 'ALL_COMPLETED',
          sessionState: secondHalfAtt,
          secondHalfStart
        };
      }
    }
  }

  // 3. Check Second Half Leave
  if (approvedLeave && approvedLeave.duration === 'half_day' && approvedLeave.halfDaySession === 'second_half') {
    const firstHalfAtt = attendanceSessions.find(a => a.sessionOrder === 1);
    if (firstHalfAtt?.checkOut || currentTimeStr >= secondHalfStart) {
      return {
        activeSession: null,
        nextSession: null,
        currentStatus: 'SECOND_HALF_LEAVE',
        secondHalfStart
      };
    }
  }

  let activeSession = null;
  let nextSession = null;
  let currentStatus = 'NO_ACTIVE_SESSION';
  let sessionState = null;

  for (let i = 0; i < sortedSessions.length; i++) {
    const s = sortedSessions[i];
    const attSession = attendanceSessions.find(a => a.sessionOrder === s.order);

    if (approvedLeave && approvedLeave.duration === 'half_day' && approvedLeave.halfDaySession === 'first_half' && s.order === 1) {
      continue;
    }

    if (approvedLeave && approvedLeave.duration === 'half_day' && approvedLeave.halfDaySession === 'second_half' && s.order === 2) {
      continue;
    }

    if (!attSession || !attSession.checkIn) {
      activeSession = s;
      currentStatus = 'CAN_CHECK_IN';
      break;
    } else if (attSession.checkIn && !attSession.checkOut) {
      activeSession = s;
      currentStatus = 'CAN_CHECK_OUT';
      sessionState = attSession;
      break;
    }
  }

  if (!activeSession && currentStatus !== 'CAN_CHECK_IN' && currentStatus !== 'CAN_CHECK_OUT') {
    currentStatus = 'ALL_COMPLETED';
  } else if (activeSession) {
    const activeIndex = sortedSessions.findIndex(s => s.order === activeSession!.order);
    if (activeIndex >= 0 && activeIndex + 1 < sortedSessions.length) {
      nextSession = sortedSessions[activeIndex + 1];
    }
  }

  return {
    activeSession,
    nextSession,
    currentStatus,
    sessionState,
    secondHalfStart
  };
}
