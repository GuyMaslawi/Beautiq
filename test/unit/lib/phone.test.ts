import { describe, it, expect } from "vitest";
import { normalizePhone, isValidIsraeliPhone } from "@/lib/phone";

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
