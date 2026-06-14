import { describe, it, expect } from "vitest";
import { minutesToTime, timeToMinutes, parseIsraelDateTime } from "@/lib/time";

describe("minutesToTime", () => {
  it("converts minutes since midnight to HH:MM", () => {
    expect(minutesToTime(540)).toBe("09:00");
    expect(minutesToTime(1020)).toBe("17:00");
    expect(minutesToTime(0)).toBe("00:00");
    expect(minutesToTime(1439)).toBe("23:59");
  });

  it("zero-pads hours and minutes", () => {
    expect(minutesToTime(65)).toBe("01:05");
  });
});

describe("timeToMinutes", () => {
  it("converts HH:MM to minutes since midnight", () => {
    expect(timeToMinutes("09:00")).toBe(540);
    expect(timeToMinutes("17:00")).toBe(1020);
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("23:59")).toBe(1439);
  });

  it("trims surrounding whitespace", () => {
    expect(timeToMinutes("  09:30 ")).toBe(570);
  });

  it("returns null for invalid format", () => {
    expect(timeToMinutes("9am")).toBeNull();
    expect(timeToMinutes("")).toBeNull();
    expect(timeToMinutes("abc")).toBeNull();
  });

  it("returns null for out-of-range values", () => {
    expect(timeToMinutes("24:00")).toBeNull();
    expect(timeToMinutes("12:60")).toBeNull();
  });

  it("round-trips with minutesToTime", () => {
    for (const m of [0, 1, 540, 725, 1439]) {
      expect(timeToMinutes(minutesToTime(m))).toBe(m);
    }
  });
});

describe("parseIsraelDateTime", () => {
  it("parses a summer (DST, UTC+3) wall-clock time to correct UTC", () => {
    // 1 July 2026 is Israel summer time (UTC+3): 09:00 local => 06:00 UTC
    const d = parseIsraelDateTime("2026-07-01", "09:00");
    expect(d.toISOString()).toBe("2026-07-01T06:00:00.000Z");
  });

  it("parses a winter (standard, UTC+2) wall-clock time to correct UTC", () => {
    // 1 January 2026 is Israel standard time (UTC+2): 09:00 local => 07:00 UTC
    const d = parseIsraelDateTime("2026-01-01", "09:00");
    expect(d.toISOString()).toBe("2026-01-01T07:00:00.000Z");
  });

  it("handles midnight correctly in summer", () => {
    const d = parseIsraelDateTime("2026-07-01", "00:00");
    expect(d.toISOString()).toBe("2026-06-30T21:00:00.000Z");
  });
});
