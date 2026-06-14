import { describe, it, expect } from "vitest";
import {
  generateThankyouMessage,
  generateReviewRequestMessage,
} from "@/lib/reputation/messages";
import { RECENT_COMPLETED_BOOKINGS_DAYS } from "@/lib/reputation/constants";

describe("generateThankyouMessage", () => {
  it("uses the 'today' phrasing when isToday is true", () => {
    const msg = generateThankyouMessage({
      clientName: "דנה",
      serviceName: "מניקור",
      businessName: "סטודיו יופי",
      isToday: true,
    });
    expect(msg).toContain("היום");
    expect(msg).toContain("דנה");
    expect(msg).toContain("מניקור");
    expect(msg).toContain("סטודיו יופי");
  });

  it("uses the neutral phrasing when isToday is false", () => {
    const today = generateThankyouMessage({
      clientName: "דנה",
      serviceName: "מניקור",
      businessName: "סטודיו",
      isToday: true,
    });
    const other = generateThankyouMessage({
      clientName: "דנה",
      serviceName: "מניקור",
      businessName: "סטודיו",
      isToday: false,
    });
    expect(other).not.toBe(today);
    expect(other).not.toContain("היום");
  });
});

describe("generateReviewRequestMessage", () => {
  it("includes client + business name and asks for a review", () => {
    const msg = generateReviewRequestMessage({
      clientName: "דנה",
      businessName: "סטודיו יופי",
    });
    expect(msg).toContain("דנה");
    expect(msg).toContain("סטודיו יופי");
    expect(msg).toContain("ביקורת");
  });
});

describe("RECENT_COMPLETED_BOOKINGS_DAYS", () => {
  it("is 14 days", () => {
    expect(RECENT_COMPLETED_BOOKINGS_DAYS).toBe(14);
  });
});
