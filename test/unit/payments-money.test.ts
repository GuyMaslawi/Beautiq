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
  const base: PaymentPolicy = {
    requirement: "none",
    depositType: "fixed_amount",
    depositAmountMinor: null,
    depositPercentage: null,
  };

  it("requires nothing when requirement is none", () => {
    expect(computePaymentAmount(base, 15000)).toEqual({
      amountMinor: 0,
      kind: "none",
    });
  });

  it("computes full payment as the whole price", () => {
    expect(
      computePaymentAmount({ ...base, requirement: "full_payment" }, 15000),
    ).toEqual({ amountMinor: 15000, kind: "full" });
  });

  it("computes a fixed-amount deposit", () => {
    expect(
      computePaymentAmount(
        {
          ...base,
          requirement: "deposit",
          depositType: "fixed_amount",
          depositAmountMinor: 5000,
        },
        15000,
      ),
    ).toEqual({ amountMinor: 5000, kind: "deposit" });
  });

  it("computes a percentage deposit", () => {
    expect(
      computePaymentAmount(
        {
          ...base,
          requirement: "deposit",
          depositType: "percentage",
          depositPercentage: 30,
        },
        15000,
      ),
    ).toEqual({ amountMinor: 4500, kind: "deposit" });
  });

  it("clamps a deposit larger than the price down to the price", () => {
    expect(
      computePaymentAmount(
        {
          ...base,
          requirement: "deposit",
          depositType: "fixed_amount",
          depositAmountMinor: 99999,
        },
        15000,
      ).amountMinor,
    ).toBe(15000);
  });

  it("treats a missing deposit config as zero (no link will be created)", () => {
    expect(
      computePaymentAmount({ ...base, requirement: "deposit" }, 15000)
        .amountMinor,
    ).toBe(0);
  });
});
