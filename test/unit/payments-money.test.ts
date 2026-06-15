import { describe, it, expect } from "vitest";
import {
  toMinor,
  toMajor,
  formatMinorILS,
  computePaymentAmount,
  type PaymentPolicy,
} from "@/lib/payments/money";

describe("money conversions", () => {
  it("converts shekels to agorot and back", () => {
    expect(toMinor(150)).toBe(15000);
    expect(toMinor("150")).toBe(15000);
    expect(toMinor(149.99)).toBe(14999);
    expect(toMajor(15000)).toBe(150);
    expect(toMajor(14999)).toBe(149.99);
  });

  it("formats agorot as ILS", () => {
    expect(formatMinorILS(15000)).toBe("₪150");
    expect(formatMinorILS(14999)).toBe("₪149.99");
  });

  it("handles non-finite input safely", () => {
    expect(toMinor(NaN)).toBe(0);
    expect(toMinor("abc")).toBe(0);
  });
});

describe("computePaymentAmount", () => {
  const base: PaymentPolicy = { requirement: "none" };

  it("requires nothing when requirement is none", () => {
    expect(computePaymentAmount(base, 15000)).toEqual({
      amountMinor: 0,
      kind: "none",
    });
  });

  it("computes full payment as the whole price", () => {
    expect(
      computePaymentAmount({ requirement: "full_payment" }, 15000),
    ).toEqual({ amountMinor: 15000, kind: "full" });
  });

  it("never produces a partial/deposit amount — full payment equals the price", () => {
    const result = computePaymentAmount({ requirement: "full_payment" }, 18000);
    expect(result.kind).toBe("full");
    expect(result.amountMinor).toBe(18000);
  });

  it("clamps a negative price to zero", () => {
    expect(
      computePaymentAmount({ requirement: "full_payment" }, -500).amountMinor,
    ).toBe(0);
  });
});
