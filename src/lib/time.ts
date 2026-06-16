const TZ = "Asia/Jerusalem";

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
 * Parse a "YYYY-MM-DD" date and "HH:MM" time that represent Asia/Jerusalem
 * wall-clock time and return the correct UTC Date.
 *
 * Handles Israel DST correctly (UTC+2 in winter, UTC+3 in summer) by trying
 * both offsets and verifying with Intl. Safe for booking times 00:00–23:59.
 */
export function parseIsraelDateTime(date: string, time: string): Date {
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
