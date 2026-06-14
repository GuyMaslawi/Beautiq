import { describe, it, expect } from "vitest";
import { generateRetentionMessage } from "@/lib/retention/messages";

describe("generateRetentionMessage", () => {
  it("includes the service name when provided", () => {
    const msg = generateRetentionMessage({
      clientName: "דנה",
      businessName: "סטודיו יופי",
      serviceName: "מניקור ג'ל",
    });
    expect(msg).toContain("דנה");
    expect(msg).toContain("סטודיו יופי");
    expect(msg).toContain("מניקור ג'ל");
  });

  it("omits the service phrasing when serviceName is absent", () => {
    const msg = generateRetentionMessage({
      clientName: "דנה",
      businessName: "סטודיו יופי",
    });
    expect(msg).toContain("דנה");
    expect(msg).toContain("סטודיו יופי");
    // The without-service variant should not mention "ל־<service>"
    expect(msg).not.toContain("מניקור");
  });

  it("treats an empty-string serviceName as absent", () => {
    const withEmpty = generateRetentionMessage({
      clientName: "דנה",
      businessName: "סטודיו",
      serviceName: "",
    });
    const without = generateRetentionMessage({
      clientName: "דנה",
      businessName: "סטודיו",
    });
    expect(withEmpty).toBe(without);
  });

  it("is Hebrew and friendly", () => {
    const msg = generateRetentionMessage({
      clientName: "דנה",
      businessName: "סטודיו",
    });
    expect(msg).toMatch(/[֐-׿]/);
    expect(msg).toContain("❤️");
  });
});
