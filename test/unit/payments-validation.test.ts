import { describe, it, expect } from "vitest";
import { validatePaymentSettings } from "@/lib/validation/payments";

function raw(over: Record<string, string> = {}) {
  return {
    enabled: "true",
    provider: "mock",
    requirement: "none",
    depositType: "fixed_amount",
    depositAmount: "",
    depositPercentage: "",
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

  it("requires a positive deposit amount for fixed deposits", () => {
    const res = validatePaymentSettings(
      raw({ requirement: "deposit", depositType: "fixed_amount", depositAmount: "0" }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.depositAmount).toBeTruthy();
  });

  it("converts a fixed deposit amount to agorot", () => {
    const res = validatePaymentSettings(
      raw({ requirement: "deposit", depositType: "fixed_amount", depositAmount: "50" }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.depositAmountMinor).toBe(5000);
  });

  it("rejects an out-of-range deposit percentage", () => {
    for (const pct of ["0", "101", "-5", "abc"]) {
      const res = validatePaymentSettings(
        raw({ requirement: "deposit", depositType: "percentage", depositPercentage: pct }),
      );
      expect(res.ok).toBe(false);
    }
  });

  it("accepts a valid deposit percentage", () => {
    const res = validatePaymentSettings(
      raw({ requirement: "deposit", depositType: "percentage", depositPercentage: "30" }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.depositPercentage).toBe(30);
  });

  it("falls back to safe enum defaults on unknown values", () => {
    const res = validatePaymentSettings(
      raw({ provider: "evil", requirement: "wat", depositType: "nope" }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.provider).toBe("mock");
      expect(res.value.requirement).toBe("none");
      expect(res.value.depositType).toBe("fixed_amount");
    }
  });

  it("does not require deposit fields when requirement is full_payment", () => {
    const res = validatePaymentSettings(raw({ requirement: "full_payment" }));
    expect(res.ok).toBe(true);
  });

  it("trims and caps instructions length", () => {
    const long = "א".repeat(900);
    const res = validatePaymentSettings(raw({ instructions: `  ${long}  ` }));
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.value.instructions ?? "").length).toBe(500);
  });
});
