import { describe, it, expect } from "vitest";
import { validatePaymentSettings } from "@/lib/validation/payments";

function raw(over: Record<string, string> = {}) {
  return {
    enabled: "true",
    provider: "mock",
    requirement: "none",
    allowPayAtBusiness: "true",
    instructions: "",
    ...over,
  };
}

describe("validatePaymentSettings", () => {
  it("accepts a minimal 'none' policy", () => {
    const res = validatePaymentSettings(raw());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.requirement).toBe("none");
      expect(res.value.enabled).toBe(true);
      expect(res.value.allowPayAtBusiness).toBe(true);
    }
  });

  it("accepts a full_payment policy", () => {
    const res = validatePaymentSettings(raw({ requirement: "full_payment" }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.requirement).toBe("full_payment");
  });

  it("never accepts a deposit requirement — falls back to none", () => {
    const res = validatePaymentSettings(raw({ requirement: "deposit" }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.requirement).toBe("none");
  });

  it("does not surface any deposit fields on the validated value", () => {
    const res = validatePaymentSettings(raw({ requirement: "full_payment" }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect("depositType" in res.value).toBe(false);
      expect("depositAmountMinor" in res.value).toBe(false);
      expect("depositPercentage" in res.value).toBe(false);
    }
  });

  it("falls back to safe enum defaults on unknown values", () => {
    const res = validatePaymentSettings(raw({ provider: "evil", requirement: "wat" }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.provider).toBe("mock");
      expect(res.value.requirement).toBe("none");
    }
  });

  it("trims and caps instructions length", () => {
    const long = "א".repeat(900);
    const res = validatePaymentSettings(raw({ instructions: `  ${long}  ` }));
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.value.instructions ?? "").length).toBe(500);
  });
});
