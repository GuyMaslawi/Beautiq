import { describe, it, expect } from "vitest";
import {
  generateMessage,
  type MessageScenario,
  type GeneratorContext,
} from "@/lib/messages/smart-message-generator";
import { TEMPLATE_TYPE_LABELS } from "@/lib/messages/template-labels";

const FULL_CTX: GeneratorContext = {
  businessName: "סטודיו יופי",
  clientName: "דנה",
  serviceName: "מניקור",
  bookingDate: "12 בינואר",
  bookingTime: "14:30",
  price: "150",
  depositAmount: "50",
};

const ALL_SCENARIOS: MessageScenario[] = [
  "booking_confirmation",
  "booking_reminder",
  "deposit_request",
  "booking_cancelled",
  "booking_rescheduled",
  "after_treatment",
  "rebook_reminder",
  "no_show_followup",
  "not_returned",
];

describe("generateMessage — full context", () => {
  it.each(ALL_SCENARIOS)(
    "produces a non-empty Hebrew body with no leftover placeholders for %s (all tones)",
    (scenario) => {
      for (const tone of ["regular", "warm", "concise"] as const) {
        const res = generateMessage(scenario, FULL_CTX, tone);
        expect(res.missingContext).toEqual([]);
        expect(res.body).toBeTruthy();
        // No leftover {placeholder} tokens.
        expect(res.body).not.toMatch(/\{[a-zA-Z]+\}/);
        // Business name interpolated.
        expect(res.body).toContain(FULL_CTX.clientName!);
      }
    },
  );

  it("defaults to the regular tone", () => {
    const def = generateMessage("booking_confirmation", FULL_CTX);
    const reg = generateMessage("booking_confirmation", FULL_CTX, "regular");
    expect(def.body).toBe(reg.body);
  });

  it("interpolates each variable into the booking confirmation", () => {
    const res = generateMessage("booking_confirmation", FULL_CTX, "regular");
    expect(res.body).toContain("סטודיו יופי");
    expect(res.body).toContain("מניקור");
    expect(res.body).toContain("12 בינואר");
    expect(res.body).toContain("14:30");
  });

  it("interpolates the deposit amount into the deposit request", () => {
    const res = generateMessage("deposit_request", FULL_CTX, "regular");
    expect(res.body).toContain("50");
  });
});

describe("generateMessage — missing required context", () => {
  it("returns null body + missingMsg when a required field is absent", () => {
    const res = generateMessage(
      "booking_confirmation",
      { businessName: "סטודיו", clientName: "דנה" },
      "regular",
    );
    expect(res.body).toBeNull();
    expect(res.missingContext).toHaveLength(1);
    expect(res.missingContext[0]).toContain("תור");
  });

  it("treats empty-string required fields as missing", () => {
    const res = generateMessage("booking_confirmation", {
      businessName: "סטודיו",
      clientName: "",
      serviceName: "מניקור",
      bookingDate: "12 בינואר",
      bookingTime: "14:30",
    });
    expect(res.body).toBeNull();
    expect(res.missingContext).toHaveLength(1);
  });

  it("scenarios requiring only clientName succeed with minimal context", () => {
    for (const scenario of [
      "rebook_reminder",
      "no_show_followup",
      "not_returned",
    ] as const) {
      const res = generateMessage(scenario, {
        businessName: "סטודיו יופי",
        clientName: "דנה",
      });
      expect(res.body).toBeTruthy();
      expect(res.missingContext).toEqual([]);
    }
  });

  it("deposit_request fails without depositAmount", () => {
    const res = generateMessage("deposit_request", {
      businessName: "סטודיו",
      clientName: "דנה",
      serviceName: "מניקור",
      bookingDate: "12 בינואר",
    });
    expect(res.body).toBeNull();
  });
});

describe("TEMPLATE_TYPE_LABELS", () => {
  it("exposes Hebrew labels for known template types", () => {
    expect(TEMPLATE_TYPE_LABELS.booking_confirmation).toBe("אישור תור");
    expect(TEMPLATE_TYPE_LABELS.booking_reminder).toBe("תזכורת לתור");
    expect(TEMPLATE_TYPE_LABELS.empty_slot_offer).toBe("הצעת חלון פנוי");
  });

  it("every label is a non-empty Hebrew string", () => {
    for (const value of Object.values(TEMPLATE_TYPE_LABELS)) {
      expect(value.length).toBeGreaterThan(0);
      expect(value).toMatch(/[֐-׿]/);
    }
  });
});
