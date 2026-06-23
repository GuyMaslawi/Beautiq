import { describe, it, expect } from "vitest";
import {
  validateTemplate,
  validateTemplateBatch,
  extractBodyVariables,
  findMarketingRiskWords,
  MARKETING_RISK_WORDS,
} from "@/lib/whatsapp/template-validation";
import { DEFAULT_TEMPLATES } from "@/lib/whatsapp/default-templates";
import type { DefaultTemplate } from "@/lib/whatsapp/default-templates";

function makeTemplate(overrides: Partial<DefaultTemplate> = {}): DefaultTemplate {
  return {
    name: "booking_confirmation_he",
    label: "אישור תור",
    language: "he",
    category: "UTILITY",
    group: "operational",
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

  it("accepts the Allura-branded booking_confirmation_he (5-variable BODY-only utility)", () => {
    const tpl = DEFAULT_TEMPLATES.find((t) => t.name === "booking_confirmation_he")!;
    expect(validateTemplate(tpl).ok).toBe(true);
    expect(tpl.category).toBe("UTILITY");
    expect(tpl.language).toBe("he");
    // BODY-only: the template carries no header/footer/button fields at all.
    expect(Object.keys(tpl)).not.toContain("header");
    expect(Object.keys(tpl)).not.toContain("buttons");
    // {{2}} = businessName so the body can state it is sent by Allura on behalf
    // of the specific business.
    expect(extractBodyVariables(tpl.body)).toEqual([1, 2, 3, 4, 5]);
    expect(tpl.variables).toContain("businessName");
    expect(tpl.example).toHaveLength(5);
    expect(tpl.body).toContain("Allura");
  });

  it("accepts the Allura-branded appointment_reminder_he (5-variable BODY-only utility)", () => {
    const tpl = DEFAULT_TEMPLATES.find((t) => t.name === "appointment_reminder_he")!;
    expect(validateTemplate(tpl).ok).toBe(true);
    expect(tpl.category).toBe("UTILITY");
    expect(tpl.language).toBe("he");
    expect(extractBodyVariables(tpl.body)).toEqual([1, 2, 3, 4, 5]);
    expect(tpl.variables).toHaveLength(5);
    expect(tpl.example).toHaveLength(5);
    expect(tpl.body).toContain("Allura");
  });

  it("accepts the Allura-branded review_request_he (3-variable BODY-only utility)", () => {
    const tpl = DEFAULT_TEMPLATES.find((t) => t.name === "review_request_he")!;
    expect(validateTemplate(tpl).ok).toBe(true);
    expect(extractBodyVariables(tpl.body)).toEqual([1, 2, 3]);
    expect(tpl.variables).toHaveLength(3);
    expect(tpl.example).toHaveLength(3);
    expect(tpl.body).toContain("Allura");
  });

  it("blocks an example value containing a newline (Meta 'Invalid format' class)", () => {
    const res = validateTemplate(
      makeTemplate({ example: ["דנה", "מניקור", "12 ביוני", "14:30\nעוד שורה"] }),
    );
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toContain("תו לא חוקי");
  });

  it("blocks an example value containing a tab/control char", () => {
    const res = validateTemplate(
      makeTemplate({ example: ["דנה", "מ\tניקור", "12 ביוני", "14:30"] }),
    );
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toContain("תו לא חוקי");
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

describe("marketing template content", () => {
  function makeMarketing(overrides: Partial<DefaultTemplate> = {}): DefaultTemplate {
    return makeTemplate({
      name: "win_back_offer_he",
      category: "MARKETING",
      group: "marketing",
      body: "היי {{1}}, מזמן לא ראינו אותך ב{{2}}. נשמח לקבוע לך תור חדש בזמן שנוח לך 🙂",
      example: ["נועה", "הסטודיו של יעל"],
      variables: ["clientName", "businessName"],
      automationType: "win_back",
      ...overrides,
    });
  }

  it("accepts the neutral default win-back template (no offer/discount language)", () => {
    const tpl = DEFAULT_TEMPLATES.find((t) => t.name === "win_back_offer_he")!;
    const res = validateTemplate(tpl);
    expect(res.ok, res.errors.join(" | ")).toBe(true);
    expect(tpl.category).toBe("MARKETING");
    expect(extractBodyVariables(tpl.body)).toEqual([1, 2]);
    expect(tpl.example).toHaveLength(2);
  });

  it("the default win-back template contains none of the discount/offer risk words", () => {
    const tpl = DEFAULT_TEMPLATES.find((t) => t.name === "win_back_offer_he")!;
    expect(findMarketingRiskWords(tpl.body)).toEqual([]);
    for (const word of MARKETING_RISK_WORDS) {
      expect(tpl.body).not.toContain(word);
    }
  });

  it("findMarketingRiskWords flags promotional words", () => {
    expect(findMarketingRiskWords("הזמן תור עם 10% הנחה היום")).toContain("הנחה");
    expect(findMarketingRiskWords("מבצע מיוחד רק היום!")).toEqual(
      expect.arrayContaining(["מבצע", "רק היום"]),
    );
    expect(findMarketingRiskWords("היי, מזמן לא ראינו אותך")).toEqual([]);
  });

  it("blocks a MARKETING default that contains a discount/offer word", () => {
    const res = validateTemplate(
      makeMarketing({
        body: "היי {{1}}, מגיעה לך הנחה ב{{2}}. נשמח לראותך 🙂",
      }),
    );
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toContain("תבנית שיווקית");
    expect(res.errors.join(" ")).toContain("הנחה");
  });

  it("does NOT apply the marketing word check to UTILITY templates", () => {
    // A utility body that happens to include 'חינם' is fine (utility isn't promotional review-gated).
    const res = validateTemplate(
      makeTemplate({ body: "שלום {{1}}, ה{{2}} שלך ב{{3}} ניתן חינם {{4}}. נתראה!" }),
    );
    expect(res.ok).toBe(true);
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
