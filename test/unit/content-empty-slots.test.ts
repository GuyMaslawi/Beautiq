import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  findEmptySlots,
  type AvailabilityRuleInput,
  type AvailabilityExceptionInput,
  type BookingIntervalInput,
} from "@/lib/empty-slots/find-empty-slots";

// Freeze the clock so results never depend on the current time-of-day or the
// host machine's timezone. We pick a fixed UTC instant that resolves to early
// morning (before 09:00) in Asia/Jerusalem, so "today" is never clipped to the
// current wall-clock minute and the full open window is always returned.
// 2026-06-16 is observed under DST (UTC+3), so 03:00Z => 06:00 Jerusalem.
const FROZEN_NOW = new Date("2026-06-16T03:00:00.000Z");

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

// All-week 09:00–17:00 availability (540–1020 minutes since midnight).
function allWeekRules(): AvailabilityRuleInput[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
  }));
}

// Build a UTC Date for a Jerusalem wall-clock time on a future date, far enough
// ahead that "today clipping" never interferes. Jerusalem is UTC+2 or UTC+3;
// we subtract 3h so the result lands on the intended date regardless of DST.
function jlmFuture(daysAhead: number, hour: number, minute = 0): Date {
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  const d = new Date(base.getTime() + daysAhead * 86400000);
  d.setUTCHours(hour - 3, minute, 0, 0);
  return d;
}

describe("findEmptySlots — basic gap detection", () => {
  it("returns the full open window when there are no bookings", () => {
    const slots = findEmptySlots(allWeekRules(), [], [], 30, 7);
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      expect(s.startMinutes).toBe(540);
      expect(s.endMinutes).toBe(1020);
      expect(s.durationMinutes).toBe(480);
      expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.weekday).toBeGreaterThanOrEqual(0);
      expect(s.weekday).toBeLessThanOrEqual(6);
    }
  });

  it("splits the window around a booking", () => {
    // Booking 11:00–12:00 two days ahead.
    const bookings: BookingIntervalInput[] = [
      { startTime: jlmFuture(2, 11), endTime: jlmFuture(2, 12) },
    ];
    const slots = findEmptySlots(allWeekRules(), [], bookings, 30, 7);
    const dayKey = jlmFuture(2, 11)
      .toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
    const daySlots = slots.filter((s) => s.date === dayKey);
    // Expect a 09:00–11:00 gap and a 12:00–17:00 gap.
    expect(daySlots).toHaveLength(2);
    expect(daySlots[0]).toMatchObject({ startMinutes: 540, endMinutes: 660 });
    expect(daySlots[1]).toMatchObject({ startMinutes: 720, endMinutes: 1020 });
  });
});

describe("findEmptySlots — minGapMinutes threshold", () => {
  it("excludes gaps shorter than minGapMinutes (boundary)", () => {
    // Booking 09:00–16:30 leaves a 30-minute tail gap (16:30–17:00).
    const bookings: BookingIntervalInput[] = [
      { startTime: jlmFuture(2, 9), endTime: jlmFuture(2, 16, 30) },
    ];
    const dayKey = jlmFuture(2, 9)
      .toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

    // minGap 30 → the 30-min gap is included (>= is inclusive).
    const incl = findEmptySlots(allWeekRules(), [], bookings, 30, 7).filter(
      (s) => s.date === dayKey,
    );
    expect(incl).toHaveLength(1);
    expect(incl[0].durationMinutes).toBe(30);

    // minGap 31 → excluded.
    const excl = findEmptySlots(allWeekRules(), [], bookings, 31, 7).filter(
      (s) => s.date === dayKey,
    );
    expect(excl).toHaveLength(0);
  });
});

describe("findEmptySlots — availability rules", () => {
  it("skips weekdays with no rule", () => {
    // Only a rule for weekday matching 3 days ahead.
    const targetWeekday = jlmFuture(3, 12).getUTCDay();
    const rules: AvailabilityRuleInput[] = [
      { weekday: targetWeekday, startMinutes: 540, endMinutes: 1020 },
    ];
    const slots = findEmptySlots(rules, [], [], 30, 7);
    for (const s of slots) {
      expect(s.weekday).toBe(targetWeekday);
    }
  });

  it("skips windows where end <= start", () => {
    const rules: AvailabilityRuleInput[] = [
      { weekday: 0, startMinutes: 600, endMinutes: 600 },
      { weekday: 1, startMinutes: 600, endMinutes: 600 },
      { weekday: 2, startMinutes: 600, endMinutes: 600 },
      { weekday: 3, startMinutes: 600, endMinutes: 600 },
      { weekday: 4, startMinutes: 600, endMinutes: 600 },
      { weekday: 5, startMinutes: 600, endMinutes: 600 },
      { weekday: 6, startMinutes: 600, endMinutes: 600 },
    ];
    expect(findEmptySlots(rules, [], [], 30, 7)).toEqual([]);
  });
});

describe("findEmptySlots — exceptions", () => {
  it("skips a day marked closed", () => {
    const closedDay = jlmFuture(2, 12);
    const dayKey = closedDay.toLocaleDateString("en-CA", {
      timeZone: "Asia/Jerusalem",
    });
    const exceptions: AvailabilityExceptionInput[] = [
      { date: closedDay, type: "closed", startMinutes: null, endMinutes: null },
    ];
    const slots = findEmptySlots(allWeekRules(), exceptions, [], 30, 7);
    expect(slots.some((s) => s.date === dayKey)).toBe(false);
  });

  it("uses custom hours for a custom_hours exception", () => {
    const customDay = jlmFuture(2, 12);
    const dayKey = customDay.toLocaleDateString("en-CA", {
      timeZone: "Asia/Jerusalem",
    });
    const exceptions: AvailabilityExceptionInput[] = [
      {
        date: customDay,
        type: "custom_hours",
        startMinutes: 600, // 10:00
        endMinutes: 660, // 11:00
      },
    ];
    const slots = findEmptySlots(allWeekRules(), exceptions, [], 30, 7).filter(
      (s) => s.date === dayKey,
    );
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ startMinutes: 600, endMinutes: 660 });
  });

  it("skips custom_hours exceptions missing start/end", () => {
    const customDay = jlmFuture(2, 12);
    const dayKey = customDay.toLocaleDateString("en-CA", {
      timeZone: "Asia/Jerusalem",
    });
    const exceptions: AvailabilityExceptionInput[] = [
      { date: customDay, type: "custom_hours", startMinutes: null, endMinutes: null },
    ];
    const slots = findEmptySlots(allWeekRules(), exceptions, [], 30, 7).filter(
      (s) => s.date === dayKey,
    );
    expect(slots).toHaveLength(0);
  });
});

describe("findEmptySlots — lookAheadDays", () => {
  it("produces at most lookAheadDays of slots", () => {
    const slots = findEmptySlots(allWeekRules(), [], [], 30, 3);
    const uniqueDates = new Set(slots.map((s) => s.date));
    expect(uniqueDates.size).toBeLessThanOrEqual(3);
  });

  it("handles zero lookAheadDays without crashing", () => {
    expect(findEmptySlots(allWeekRules(), [], [], 30, 0)).toEqual([]);
  });

  it("handles empty rules without crashing", () => {
    expect(findEmptySlots([], [], [], 30, 7)).toEqual([]);
  });
});
