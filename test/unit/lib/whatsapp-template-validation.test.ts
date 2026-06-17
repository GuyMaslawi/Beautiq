import { describe, it, expect } from "vitest";
import {
  validateTemplate,
  validateTemplateBatch,
  extractBodyVariables,
} from "@/lib/whatsapp/template-validation";
import { DEFAULT_TEMPLATES } from "@/lib/whatsapp/default-templates";
import type { DefaultTemplate } from "@/lib/whatsapp/default-templates";

function makeTemplate(overrides: Partial<DefaultTemplate> = {}): DefaultTemplate {
  return {
    name: "booking_confirmation_he",
    label: "אישור תור",
    language: "he",
    category: "UTILITY",
    body: "שלום {{1}}, התור שלך ל{{2}} נקבע ל{{3}} בשעה {{4}}. נתראה!",
    example: ["דנה", "מניקור", "12 ביוני", "14:30"],
    variables: ["clientName", "serviceName", "bookingDate", "bookingTime"],
    automationType: "booking_confirmation",
    ...overrides,
  };
}

describe("validateTemplate", () => {
  it("accepts a valid Hebrew booking confirmation template", () => {
    const res = validateTemplate(makeTemplate());
    expect(res.ok).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it("accepts every shipped default template (no payload reaches Meta malformed)", () => {
    for (const tpl of DEFAULT_TEMPLATES) {
      const res = validateTemplate(tpl);
      expect(res.ok, `${tpl.name}: ${res.errors.join(" | ")}`).toBe(true);
    }
  });

  it("blocks a name that is not lowercase snake_case", () => {
    const res = validateTemplate(makeTemplate({ name: "BookingConfirmation" }));
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toContain("snake_case");
  });

  it("blocks Hebrew characters in the template name", () => {
    const res = validateTemplate(makeTemplate({ name: "אישור_תור" }));
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("snake_case"))).toBe(true);
  });

  it("blocks an unsupported language code", () => {
    const res = validateTemplate(makeTemplate({ language: "iw" }));
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toContain('"he"');
  });

  it("accepts both he and he_IL Hebrew codes", () => {
    expect(validateTemplate(makeTemplate({ language: "he" })).ok).toBe(true);
    expect(validateTemplate(makeTemplate({ language: "he_IL" })).ok).toBe(true);
  });

  it("blocks an unsupported category", () => {
    const res = validateTemplate(
      makeTemplate({ category: "PROMOTIONAL" as DefaultTemplate["category"] }),
    );
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toContain("קטגוריה");
  });

  it("blocks an empty body", () => {
    const res = validateTemplate(makeTemplate({ body: "   " }));
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toContain("ריק");
  });

  it("blocks out-of-order variables ({{3}} before {{1}})", () => {
    const res = validateTemplate(
      makeTemplate({ body: "תודה ב{{3}}, {{1}}! דרגי את ה{{2}}: {{4}} כאן" }),
    );
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toContain("הסדר");
  });

  it("blocks a body that ends with a variable", () => {
    const res = validateTemplate(
      makeTemplate({ body: "שלום {{1}}, ראינו ש{{2}} ב{{3}}. הצעה: {{4}}" }),
    );
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toContain("להסתיים במשתנה");
  });

  it("blocks adjacent variables", () => {
    const res = validateTemplate(
      makeTemplate({ body: "שלום {{1}}{{2}} ל{{3}} ב{{4}} נתראה" }),
    );
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toContain("צמודים");
  });

  it("blocks a mismatch between variable count and example count", () => {
    const res = validateTemplate(
      makeTemplate({
        body: "שלום {{1}}, התור ל{{2}} ב{{3}} נתראה",
        example: ["דנה", "מניקור"], // only 2 examples for 3 vars
      }),
    );
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toContain("דוגמאות");
  });

  it("blocks a missing (empty) example value", () => {
    const res = validateTemplate(
      makeTemplate({ example: ["דנה", "", "12 ביוני", "14:30"] }),
    );
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toContain("חסרה דוגמה");
  });
});

describe("validateTemplateBatch", () => {
  it("flags duplicate names within one batch", () => {
    const dup = makeTemplate({ name: "booking_confirmation_he" });
    const results = validateTemplateBatch([dup, makeTemplate()]);
    expect(results.every((r) => !r.result.ok)).toBe(true);
    expect(results[0].result.errors.join(" ")).toContain("יותר מפעם אחת");
  });

  it("passes the real default batch with no duplicates", () => {
    const results = validateTemplateBatch(DEFAULT_TEMPLATES);
    expect(results.every((r) => r.result.ok)).toBe(true);
  });
});

describe("extractBodyVariables", () => {
  it("returns variable numbers in order of appearance", () => {
    expect(extractBodyVariables("a {{1}} b {{2}} c {{3}}")).toEqual([1, 2, 3]);
    expect(extractBodyVariables("a {{3}} b {{1}}")).toEqual([3, 1]);
    expect(extractBodyVariables("no vars")).toEqual([]);
  });
});
