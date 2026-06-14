import { describe, it, expect } from "vitest";
import {
  renderMessage,
  getDefaultTemplate,
  generateWinBackMessage,
  OFFER_TEXT,
  DEFAULT_TEMPLATES,
} from "@/lib/win-back-campaigns/messages";

/**
 * Pure unit tests for the win-back campaign template library
 * (src/lib/win-back-campaigns/messages.ts).
 */

describe("renderMessage", () => {
  it("substitutes name and business name", () => {
    const out = renderMessage("היי {שם}, מ{שם העסק} שלום", {
      clientName: "דנה",
      businessName: "סטודיו יופי",
    });
    expect(out).toBe("היי דנה, מסטודיו יופי שלום");
  });

  it("substitutes optional service/offer/link variables", () => {
    const out = renderMessage(
      "{שם}: {שירות אחרון} | {הטבה} | {קישור להזמנה}",
      {
        clientName: "דנה",
        businessName: "ב",
        lastService: "מניקור",
        offer: "10% הנחה",
        bookingLink: "allura.app/x",
      },
    );
    expect(out).toBe("דנה: מניקור | 10% הנחה | allura.app/x");
  });

  it("replaces missing optional variables with empty string (no crash)", () => {
    const out = renderMessage("{שם} {שירות אחרון}{הטבה}{קישור להזמנה}", {
      clientName: "דנה",
      businessName: "ב",
    });
    expect(out).toBe("דנה ");
  });
});

describe("getDefaultTemplate", () => {
  it("returns the base template for a tone/type with no offer", () => {
    const out = getDefaultTemplate("30", "gentle", "none");
    expect(out).toBe(DEFAULT_TEMPLATES.gentle["30"]);
  });

  it("appends an offer line when an offer is provided", () => {
    const base = DEFAULT_TEMPLATES.sales["60"];
    const out = getDefaultTemplate("60", "sales", "discount_10");
    expect(out.startsWith(base)).toBe(true);
    expect(out).toContain("10% הנחה");
    expect(out.length).toBeGreaterThan(base.length);
  });

  it("supports every tone/type combination without throwing", () => {
    const tones = ["gentle", "personal", "sales", "luxury", "short"] as const;
    const types = ["30", "60", "90", "vip"] as const;
    for (const tone of tones) {
      for (const type of types) {
        expect(typeof getDefaultTemplate(type, tone)).toBe("string");
        expect(getDefaultTemplate(type, tone).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("OFFER_TEXT", () => {
  it("maps known offers to Hebrew labels and none to empty", () => {
    expect(OFFER_TEXT.none).toBe("");
    expect(OFFER_TEXT.discount_10).toContain("10%");
    expect(OFFER_TEXT.upgrade_gift).toContain("שדרוג");
  });
});

describe("generateWinBackMessage (backward-compat)", () => {
  it("renders a gentle template with name + business", () => {
    const out = generateWinBackMessage({
      campaignType: "60",
      clientName: "דנה",
      businessName: "סטודיו יופי",
    });
    expect(out).toContain("דנה");
    expect(out).toContain("סטודיו יופי");
    expect(out).not.toMatch(/\{[^}]+\}/);
  });
});
