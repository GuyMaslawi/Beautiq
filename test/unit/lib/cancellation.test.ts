import { describe, it, expect } from "vitest";
import { isLateCancellation, computeLateCancellationFee } from "@/lib/cancellation";

describe("isLateCancellation", () => {
  const start = new Date("2026-07-01T12:00:00Z");

  it("returns null when no cancellation time", () => {
    expect(isLateCancellation(null, start, 24)).toBeNull();
  });

  it("returns null when no policy configured", () => {
    expect(isLateCancellation(new Date(), start, null)).toBeNull();
    expect(isLateCancellation(new Date(), start, 0)).toBeNull();
  });

  it("returns true when cancelled inside the late window (after deadline)", () => {
    // deadline = 12:00 - 24h = previous day 12:00; cancel at 06:00 same day is late
    const cancelledAt = new Date("2026-07-01T06:00:00Z");
    expect(isLateCancellation(cancelledAt, start, 24)).toBe(true);
  });

  it("returns false when cancelled before the deadline (in time)", () => {
    const cancelledAt = new Date("2026-06-29T12:00:00Z");
    expect(isLateCancellation(cancelledAt, start, 24)).toBe(false);
  });

  it("treats cancellation exactly at the deadline as late", () => {
    const cancelledAt = new Date("2026-06-30T12:00:00Z"); // exactly 24h before
    expect(isLateCancellation(cancelledAt, start, 24)).toBe(true);
  });
});

describe("computeLateCancellationFee", () => {
  it("returns the fixed fee when configured", () => {
    expect(computeLateCancellationFee("fixed", 50, null, 200)).toBe(50);
  });

  it("computes and rounds a percentage fee", () => {
    expect(computeLateCancellationFee("percentage", null, 25, 199)).toBe(50); // 49.75 -> 50
  });

  it("returns null when fixed fee is missing or non-positive", () => {
    expect(computeLateCancellationFee("fixed", null, null, 200)).toBeNull();
    expect(computeLateCancellationFee("fixed", 0, null, 200)).toBeNull();
  });

  it("returns null when percentage is missing or non-positive", () => {
    expect(computeLateCancellationFee("percentage", null, null, 200)).toBeNull();
    expect(computeLateCancellationFee("percentage", null, 0, 200)).toBeNull();
  });

  it("returns null for an unknown fee type", () => {
    expect(computeLateCancellationFee("none", 50, 25, 200)).toBeNull();
  });
});
