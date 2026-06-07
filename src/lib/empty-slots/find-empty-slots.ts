const TZ = "Asia/Jerusalem";

export interface EmptySlot {
  date: string; // "YYYY-MM-DD" in Jerusalem timezone
  weekday: number; // 0–6, 0 = Sunday (JS getDay convention)
  startMinutes: number; // minutes since Jerusalem midnight
  endMinutes: number;
  durationMinutes: number;
}

export interface AvailabilityRuleInput {
  weekday: number;
  startMinutes: number;
  endMinutes: number;
}

export interface AvailabilityExceptionInput {
  date: Date;
  type: "closed" | "custom_hours";
  startMinutes: number | null;
  endMinutes: number | null;
}

export interface BookingIntervalInput {
  startTime: Date;
  endTime: Date;
}

// Returns UTC timestamp (ms) of Jerusalem midnight for the given "YYYY-MM-DD" date string.
function jerusalemMidnightUTC(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  // Noon UTC on this date is always within this Jerusalem calendar date (UTC+2/+3).
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12));
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(noonUTC);
  const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  return noonUTC.getTime() - (h * 60 + m) * 60000;
}

// Weekday (0-6, Sunday=0) for a "YYYY-MM-DD" Jerusalem date.
function weekdayFromDateStr(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

function findGaps(
  openStart: number,
  openEnd: number,
  bookings: { startMin: number; endMin: number }[],
): { start: number; end: number }[] {
  const gaps: { start: number; end: number }[] = [];
  let cursor = openStart;

  for (const b of bookings) {
    if (b.startMin > cursor) {
      gaps.push({ start: cursor, end: b.startMin });
    }
    cursor = Math.max(cursor, b.endMin);
  }

  if (cursor < openEnd) {
    gaps.push({ start: cursor, end: openEnd });
  }

  return gaps;
}

export function findEmptySlots(
  rules: AvailabilityRuleInput[],
  exceptions: AvailabilityExceptionInput[],
  bookings: BookingIntervalInput[],
  minGapMinutes: number,
  lookAheadDays = 7,
): EmptySlot[] {
  const now = new Date();
  const slots: EmptySlot[] = [];

  // Index rules by weekday for O(1) lookup.
  const ruleByWeekday = new Map<number, AvailabilityRuleInput>();
  for (const rule of rules) {
    ruleByWeekday.set(rule.weekday, rule);
  }

  // Index exceptions by Jerusalem date string.
  const exceptionByDate = new Map<string, AvailabilityExceptionInput>();
  for (const ex of exceptions) {
    const key = ex.date.toLocaleDateString("en-CA", { timeZone: TZ });
    exceptionByDate.set(key, ex);
  }

  // Today's date string in Jerusalem.
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: TZ });

  for (let i = 0; i < lookAheadDays; i++) {
    // Advance by exactly i days (86400s) from now; toLocaleDateString resolves the Jerusalem date.
    const dayDate = new Date(now.getTime() + i * 86400000);
    const dateStr = dayDate.toLocaleDateString("en-CA", { timeZone: TZ });

    const exception = exceptionByDate.get(dateStr);
    if (exception?.type === "closed") continue;

    const weekday = weekdayFromDateStr(dateStr);

    // Resolve the open window for this day.
    let openStart: number;
    let openEnd: number;

    if (exception?.type === "custom_hours") {
      if (exception.startMinutes == null || exception.endMinutes == null) continue;
      openStart = exception.startMinutes;
      openEnd = exception.endMinutes;
    } else {
      const rule = ruleByWeekday.get(weekday);
      if (!rule) continue;
      openStart = rule.startMinutes;
      openEnd = rule.endMinutes;
    }

    if (openEnd <= openStart) continue;

    // For today: clip openStart to the current time so we only surface future gaps.
    if (dateStr === todayStr) {
      const midnightMs = jerusalemMidnightUTC(dateStr);
      const nowMinutes = Math.ceil((now.getTime() - midnightMs) / 60000);
      openStart = Math.max(openStart, nowMinutes);
      if (openStart >= openEnd) continue;
    }

    const midnightMs = jerusalemMidnightUTC(dateStr);

    // Map bookings to [startMin, endMin] relative to Jerusalem midnight, clipped to open window.
    const dayBookings = bookings
      .map((b) => ({
        startMin: Math.round((b.startTime.getTime() - midnightMs) / 60000),
        endMin: Math.round((b.endTime.getTime() - midnightMs) / 60000),
      }))
      .filter((b) => b.startMin < openEnd && b.endMin > openStart)
      .map((b) => ({
        startMin: Math.max(b.startMin, openStart),
        endMin: Math.min(b.endMin, openEnd),
      }))
      .sort((a, b) => a.startMin - b.startMin);

    for (const gap of findGaps(openStart, openEnd, dayBookings)) {
      const duration = gap.end - gap.start;
      if (duration >= minGapMinutes) {
        slots.push({
          date: dateStr,
          weekday,
          startMinutes: gap.start,
          endMinutes: gap.end,
          durationMinutes: duration,
        });
      }
    }
  }

  return slots;
}
