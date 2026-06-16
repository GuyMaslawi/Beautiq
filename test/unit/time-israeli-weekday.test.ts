import { describe, it, expect } from "vitest";
import { israeliWeekday, parseIsraelDateTime } from "@/lib/time";

/**
 * israeliWeekday must return the weekday (0 = Sunday … 6 = Saturday) for a
 * YYYY-MM-DD date as it falls in Asia/Jerusalem — matching the
 * AvailabilityRule.weekday convention — regardless of the server's timezone or
 * DST. This is the value the slot lookup uses to find the day's open hours, so
 * an off-by-one here means "no availability rules" → an empty time list.
 */
describe("israeliWeekday", () => {
  it("maps the Israeli week: Sunday=0 … Saturday=6", () => {
    // June 2026 — verified calendar days.
    expect(israeliWeekday("2026-06-21")).toBe(0); // Sunday
    expect(israeliWeekday("2026-06-15")).toBe(1); // Monday
    expect(israeliWeekday("2026-06-16")).toBe(2); // Tuesday
    expect(israeliWeekday("2026-06-17")).toBe(3); // Wednesday
    expect(israeliWeekday("2026-06-18")).toBe(4); // Thursday
    expect(israeliWeekday("2026-06-19")).toBe(5); // Friday
    expect(israeliWeekday("2026-06-20")).toBe(6); // Saturday (closed for many)
  });

  it("is correct in Israel winter time (UTC+2)", () => {
    expect(israeliWeekday("2026-01-04")).toBe(0); // Sunday, winter
    expect(israeliWeekday("2026-01-05")).toBe(1); // Monday, winter
  });

  it("is correct in Israel summer time / DST (UTC+3)", () => {
    expect(israeliWeekday("2026-07-05")).toBe(0); // Sunday, summer
    expect(israeliWeekday("2026-08-07")).toBe(5); // Friday, summer
  });

  it("preserves the intended calendar day (no timezone shift)", () => {
    // The 18th must read as the 18th's weekday — never drift to the 17th/19th.
    const date = "2026-06-18";
    const noon = parseIsraelDateTime(date, "12:00");
    const dayInIsrael = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
    }).format(noon);
    expect(dayInIsrael).toBe(date);
    expect(israeliWeekday(date)).toBe(4); // Thursday
  });

  it("only accepts ISO YYYY-MM-DD — a DD/MM/YYYY display string is rejected, never silently wrong", () => {
    // Guards against feeding localized "18/06/2026" display strings to the
    // backend: it must not resolve to a plausible-but-wrong weekday. The helper
    // throws on such input rather than returning a bogus day.
    expect(() => israeliWeekday("18/06/2026")).toThrow();
  });
});
