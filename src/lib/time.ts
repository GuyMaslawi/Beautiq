const TZ = "Asia/Jerusalem";

/**
 * Whether an appointment's start time has already arrived (relative to now).
 *
 * Outcome actions on a booking ("הושלם" / "לא הגיעה") only make sense once the
 * appointment has started, so both the UI and the server gate them on this.
 * Wrapping the `new Date()` read here keeps the impurity out of component render
 * bodies (react-hooks/purity).
 */
export function bookingHasStarted(startTime: Date): boolean {
  return startTime.getTime() <= new Date().getTime();
}

/**
 * Converts minutes since midnight (0–1439) to a HH:MM string (24-hour).
 * Example: 540 → "09:00", 1020 → "17:00"
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Converts a HH:MM string to minutes since midnight (0–1439).
 * Returns null for invalid or empty input.
 */
export function timeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * True when `value` is a real calendar date written as "YYYY-MM-DD".
 *
 * A regex alone is not enough. `/^\d{4}-\d{2}-\d{2}$/` happily accepts
 * "2026-99-99", and Date.UTC() then rolls the overflow forward silently — that
 * input lands in **2034**. Anywhere a rolled-over date slips past a "not in the
 * past" or "not too far ahead" guard, it is checked against a date the caller
 * never asked about. So the month/day are verified to survive the round-trip.
 *
 * The year is bounded to a sane calendar range: values like "9999999-01-01"
 * produce a timestamp outside the Date range, which makes Intl throw.
 */
export function isValidDateStr(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, mo, d] = value.split("-").map(Number);
  if (y < 1970 || y > 2999) return false;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  // Round-trip through UTC: a rolled-over date comes back as different parts.
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === mo - 1 &&
    probe.getUTCDate() === d
  );
}

/** True when `value` is a valid 24-hour "HH:MM" wall-clock time. */
export function isValidTimeStr(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/**
 * Parse a "YYYY-MM-DD" date and "HH:MM" time that represent Asia/Jerusalem
 * wall-clock time and return the correct UTC Date.
 *
 * Handles Israel DST correctly (UTC+2 in winter, UTC+3 in summer) by trying
 * both offsets and verifying with Intl. Safe for booking times 00:00–23:59.
 *
 * THROWS on input that is not a real date/time. Previously such input produced
 * `new Date(NaN)`, and the very first `Intl.formatToParts` call below raised a
 * bare `RangeError: Invalid time value` from deep inside the function — which
 * surfaced as an unhandled 500 in any caller that had not format-checked its
 * input first. Failing here, explicitly and early, keeps that impossible: every
 * caller either validates up front (see isValidDateStr / isValidTimeStr) or gets
 * a named error it can catch.
 */
export function parseIsraelDateTime(date: string, time: string): Date {
  if (!isValidDateStr(date) || !isValidTimeStr(time)) {
    throw new InvalidDateTimeError(date, time);
  }
  return parseIsraelDateTimeUnchecked(date, time);
}

/** Raised by parseIsraelDateTime for input that is not a real date/time. */
export class InvalidDateTimeError extends Error {
  constructor(date: string, time: string) {
    super(`Invalid Israel date/time: ${JSON.stringify({ date, time })}`);
    this.name = "InvalidDateTimeError";
  }
}

function parseIsraelDateTimeUnchecked(date: string, time: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Israel is UTC+2 (winter) or UTC+3 (summer). Try both; verify with Intl.
  for (const utcOffset of [3, 2]) {
    const candidateMs = Date.UTC(y, mo - 1, d, h - utcOffset, mi, 0);
    const candidate = new Date(candidateMs);
    const parts = fmt.formatToParts(candidate);
    const get = (type: string) =>
      parseInt(parts.find((p) => p.type === type)!.value, 10);

    if (
      get("year") === y &&
      get("month") === mo &&
      get("day") === d &&
      get("hour") === h &&
      get("minute") === mi
    ) {
      return candidate;
    }
  }

  // Fallback: assume UTC+3 (Israel summer time)
  return new Date(Date.UTC(y, mo - 1, d, h - 3, mi, 0));
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Return the weekday (0 = Sunday … 6 = Saturday, Israeli week order) for a
 * "YYYY-MM-DD" date as it falls in Asia/Jerusalem — independent of the server's
 * own timezone.
 *
 * This matches the `AvailabilityRule.weekday` convention (JS getDay order). We
 * anchor at local noon to stay clear of any midnight/DST edge, then read the
 * weekday back in Asia/Jerusalem so the calendar day is always preserved.
 */
export function israeliWeekday(date: string): number {
  const noon = parseIsraelDateTime(date, "12:00");
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(noon);
  return WEEKDAY_INDEX[short];
}
