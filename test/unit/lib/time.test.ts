import { describe, it, expect } from "vitest";
import {
  minutesToTime,
  timeToMinutes,
  parseIsraelDateTime,
  isValidDateStr,
  isValidTimeStr,
  InvalidDateTimeError,
} from "@/lib/time";

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

// ---------------------------------------------------------------------------
// אימות תאריך/שעה — הגנה על כל מי שמזין קלט למנתח התאריכים
// ---------------------------------------------------------------------------

describe("isValidDateStr", () => {
  it("accepts real calendar dates", () => {
    expect(isValidDateStr("2026-07-01")).toBe(true);
    expect(isValidDateStr("2024-02-29")).toBe(true); // שנה מעוברת
  });

  it("rejects anything that is not YYYY-MM-DD", () => {
    expect(isValidDateStr("")).toBe(false);
    expect(isValidDateStr("abc")).toBe(false);
    expect(isValidDateStr("2026-7-1")).toBe(false);
    expect(isValidDateStr("2026/07/01")).toBe(false);
  });

  // הליבה של התיקון: בדיקת תבנית לבדה עוברת על "2026-99-99", ו-Date.UTC
  // מגלגל את החריגה קדימה בשקט — התאריך הזה נוחת ב-2034.
  it("rejects shape-valid dates that do not exist", () => {
    expect(isValidDateStr("2026-99-99")).toBe(false);
    expect(isValidDateStr("2026-13-01")).toBe(false);
    expect(isValidDateStr("2026-02-30")).toBe(false);
    expect(isValidDateStr("2023-02-29")).toBe(false); // אינה שנה מעוברת
  });

  it("rejects years outside a sane calendar range", () => {
    expect(isValidDateStr("0001-01-01")).toBe(false);
    expect(isValidDateStr("9999-01-01")).toBe(false);
  });
});

describe("isValidTimeStr", () => {
  it("accepts 24-hour HH:MM", () => {
    expect(isValidTimeStr("00:00")).toBe(true);
    expect(isValidTimeStr("09:30")).toBe(true);
    expect(isValidTimeStr("23:59")).toBe(true);
  });

  it("rejects out-of-range and malformed times", () => {
    expect(isValidTimeStr("24:00")).toBe(false);
    expect(isValidTimeStr("25:99")).toBe(false);
    expect(isValidTimeStr("9:30")).toBe(false);
    expect(isValidTimeStr("")).toBe(false);
    expect(isValidTimeStr("xx")).toBe(false);
  });
});

describe("parseIsraelDateTime — invalid input", () => {
  // רגרסיה: קודם, קלט לא תקין ייצר new Date(NaN), והקריאה הראשונה ל-Intl
  // בתוך הפונקציה זרקה RangeError גולמי — כלומר 500 לא מטופל בכל קורא
  // שלא בדק את הקלט קודם. עכשיו הכישלון מפורש וניתן לתפיסה.
  it("throws a NAMED error instead of a raw Intl RangeError", () => {
    expect(() => parseIsraelDateTime("", "")).toThrow(InvalidDateTimeError);
    expect(() => parseIsraelDateTime("abc", "xx")).toThrow(InvalidDateTimeError);
    expect(() => parseIsraelDateTime("9999999-01-01", "00:00")).toThrow(
      InvalidDateTimeError,
    );
  });

  it("refuses to silently roll a non-existent date into another year", () => {
    // "2026-99-99" @ "12:00" נחת קודם ב-2034 בלי שאיש שם לב.
    expect(() => parseIsraelDateTime("2026-99-99", "12:00")).toThrow(
      InvalidDateTimeError,
    );
  });
});
