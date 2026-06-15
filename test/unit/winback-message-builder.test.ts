import { describe, it, expect } from "vitest";
import {
  buildWinBackMessage,
  buildOfferText,
  DEFAULT_WIN_BACK_TEMPLATE,
} from "@/server/win-back-automation/message-builder";

/**
 * Pure unit tests for the win-back message builder. No Prisma / no env needed —
 * these only exercise string substitution and offer-text resolution.
 */

describe("buildOfferText", () => {
  it("returns the predefined Hebrew text for known offer types", () => {
    expect(buildOfferText("discount_10")).toContain("10%");
    expect(buildOfferText("upgrade")).toContain("שדרוג");
    expect(buildOfferText("special_slot")).toContain("תור פנוי");
  });

  it("returns empty string for the 'none' offer type", () => {
    expect(buildOfferText("none")).toBe("");
  });

  it("returns the custom value for the 'custom' offer type", () => {
    expect(buildOfferText("custom", "הטבה אישית בשבילך")).toBe(
      "הטבה אישית בשבילך",
    );
  });

  it("returns empty string for a custom offer with no value supplied", () => {
    expect(buildOfferText("custom", null)).toBe("");
    expect(buildOfferText("custom", undefined)).toBe("");
  });
});

describe("buildWinBackMessage", () => {
  const base = {
    clientName: "דנה",
    businessName: "סטודיו יופי",
    lastServiceName: "מניקור ג'ל",
    offerType: "discount_10" as const,
  };

  it("substitutes every supported variable in the default template", () => {
    const msg = buildWinBackMessage(base);
    expect(msg).toContain("דנה");
    expect(msg).toContain("סטודיו יופי");
    expect(msg).toContain("מניקור ג'ל");
    // discount offer text is injected via {הטבה}
    expect(msg).toContain("10%");
    // no leftover placeholders
    expect(msg).not.toMatch(/\{[^}]+\}/);
  });

  it("produces Hebrew output (default template body present)", () => {
    const msg = buildWinBackMessage(base);
    expect(msg).toContain("עבר זמן מה");
    expect(msg).toContain("נשמח לראות אותך");
  });

  it("honours a custom template string", () => {
    const msg = buildWinBackMessage({
      ...base,
      offerType: "none",
      template: "שלום {שם}, מ{שם_העסק} מתגעגעים אלייך! קישור: {קישור_להזמנה}",
      bookingUrl: "allura.info/b/studio",
    });
    expect(msg).toBe("שלום דנה, מסטודיו יופי מתגעגעים אלייך! קישור: allura.info/b/studio");
  });

  it("honours a custom offer value via {הטבה}", () => {
    const msg = buildWinBackMessage({
      ...base,
      offerType: "custom",
      offerValue: "מתנה מיוחדת 🎁",
      template: "{שם}: {הטבה}",
    });
    expect(msg).toBe("דנה: מתנה מיוחדת 🎁");
  });

  it("collapses the blank line left by an empty offer (offerType none)", () => {
    const msg = buildWinBackMessage({ ...base, offerType: "none" });
    // The {הטבה} line becomes empty; double newlines must be collapsed.
    expect(msg).not.toMatch(/\n\n/);
    expect(msg).not.toContain("10%");
  });

  it("does not crash when optional vars (bookingUrl/offerValue/template) are missing", () => {
    expect(() =>
      buildWinBackMessage({
        clientName: "x",
        businessName: "y",
        lastServiceName: "z",
        offerType: "none",
      }),
    ).not.toThrow();
  });

  it("replaces an unused {קישור_להזמנה} with empty string when no bookingUrl is given", () => {
    const msg = buildWinBackMessage({
      ...base,
      offerType: "none",
      template: "היי {שם}{קישור_להזמנה}",
    });
    expect(msg).toBe("היי דנה");
  });

  it("exports the default template constant", () => {
    expect(DEFAULT_WIN_BACK_TEMPLATE).toContain("{שם}");
    expect(DEFAULT_WIN_BACK_TEMPLATE).toContain("{שם_העסק}");
  });
});
