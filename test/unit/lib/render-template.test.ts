import { describe, it, expect } from "vitest";
import { renderTemplate } from "@/lib/messages/render-template";

describe("renderTemplate", () => {
  it("replaces all known variables", () => {
    const body =
      "היי {clientName}, התור שלך ל־{serviceName} אצל {businessName} נקבע ל־{bookingDate} בשעה {bookingTime}. מחיר: {price}, מקדמה: {depositAmount}";
    const out = renderTemplate(body, {
      clientName: "דנה",
      serviceName: "מניקור",
      businessName: "סטודיו",
      bookingDate: "1 ביולי",
      bookingTime: "10:00",
      price: "150",
      depositAmount: "50",
    });
    expect(out).toContain("דנה");
    expect(out).toContain("מניקור");
    expect(out).toContain("סטודיו");
    expect(out).not.toContain("{");
  });

  it("replaces multiple occurrences of the same variable", () => {
    expect(renderTemplate("{clientName} {clientName}", { clientName: "דנה" })).toBe(
      "דנה דנה",
    );
  });

  it("uses the Hebrew fallback for missing variables", () => {
    expect(renderTemplate("שלום {clientName}", {})).toBe("שלום לא צוין");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(renderTemplate("{unknownVar}", { clientName: "x" })).toBe("{unknownVar}");
  });

  it("returns the body unchanged when there are no placeholders", () => {
    expect(renderTemplate("טקסט רגיל", {})).toBe("טקסט רגיל");
  });
});
