import { describe, it, expect } from "vitest";
import { normalizePhone, isValidIsraeliPhone, toWaPhone, phonesEqual } from "@/lib/phone";

describe("normalizePhone", () => {
  it("normalizes a local 0-prefixed mobile to E.164", () => {
    expect(normalizePhone("0501234567")).toBe("+972501234567");
  });

  it("strips separators (dashes, spaces)", () => {
    expect(normalizePhone("050-123-4567")).toBe("+972501234567");
    expect(normalizePhone("050 123 4567")).toBe("+972501234567");
  });

  it("handles an already-+972 number", () => {
    expect(normalizePhone("+972501234567")).toBe("+972501234567");
  });

  it("handles a 972-prefixed number without plus", () => {
    expect(normalizePhone("972501234567")).toBe("+972501234567");
  });

  it("is idempotent", () => {
    const once = normalizePhone("050-123-4567");
    expect(normalizePhone(once)).toBe(once);
  });

  it("produces a stable key for the same number across formats", () => {
    const formats = ["0501234567", "050-123-4567", "+972501234567", "972 50 123 4567"];
    const normalized = formats.map(normalizePhone);
    expect(new Set(normalized).size).toBe(1);
  });
});

describe("isValidIsraeliPhone", () => {
  it("accepts a valid mobile number in various formats", () => {
    expect(isValidIsraeliPhone("0501234567")).toBe(true);
    expect(isValidIsraeliPhone("+972501234567")).toBe(true);
    expect(isValidIsraeliPhone("050-123-4567")).toBe(true);
  });

  it("accepts a 9-digit landline (e.g. 03-xxxxxxx)", () => {
    expect(isValidIsraeliPhone("03-1234567")).toBe(true);
  });

  it("rejects too-short numbers", () => {
    expect(isValidIsraeliPhone("12345")).toBe(false);
    expect(isValidIsraeliPhone("050123")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isValidIsraeliPhone("")).toBe(false);
  });

  it("rejects numbers that are too long", () => {
    expect(isValidIsraeliPhone("05012345678901")).toBe(false);
  });
});

describe("toWaPhone (Meta recipient format)", () => {
  it("returns E.164 digits WITHOUT the leading +", () => {
    expect(toWaPhone("0525756333")).toBe("972525756333");
    expect(toWaPhone("+972525756333")).toBe("972525756333");
    expect(toWaPhone("972525756333")).toBe("972525756333");
  });

  it("strips the leading 0 correctly for local numbers", () => {
    expect(toWaPhone("0544961155")).toBe("972544961155");
  });

  it("produces the same Meta number across all input formats", () => {
    const formats = ["0544961155", "054-496-1155", "+972544961155", "972 54 496 1155"];
    expect(new Set(formats.map(toWaPhone)).size).toBe(1);
  });
});

describe("phonesEqual (format-agnostic comparison)", () => {
  it("treats +972, 972, and 0-prefixed forms as equal", () => {
    expect(phonesEqual("972544961155", "+972544961155")).toBe(true);
    expect(phonesEqual("0544961155", "+972544961155")).toBe(true);
    expect(phonesEqual("054-496-1155", "972544961155")).toBe(true);
  });

  it("returns false for different numbers", () => {
    expect(phonesEqual("0544961155", "0501234567")).toBe(false);
  });

  it("returns false when either side is empty", () => {
    expect(phonesEqual("", "+972544961155")).toBe(false);
    expect(phonesEqual("+972544961155", "")).toBe(false);
  });
});
