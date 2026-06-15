import { describe, it, expect } from "vitest";
import {
  validateBusinessDetails,
  validateCancellationPolicy,
} from "@/lib/validation/settings";
import { SETTINGS } from "@/lib/constants/he";

/**
 * Pure validator tests for the settings forms. These guard the PUBLIC business
 * data (name shown on the public page, contact phone) — invalid input must be
 * rejected before it can reach the DB.
 */

describe("validateBusinessDetails", () => {
  it("accepts a minimal valid payload (name only) and trims fields", () => {
    const r = validateBusinessDetails({ name: "  סטודיו יופי  " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe("סטודיו יופי");
      expect(r.value.phone).toBeUndefined();
      expect(r.value.city).toBeUndefined();
    }
  });

  it("requires a business name", () => {
    const r = validateBusinessDetails({ name: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.name).toBe(SETTINGS.errors.nameRequired);
  });

  it("rejects an invalid Israeli phone but keeps an empty phone valid", () => {
    const bad = validateBusinessDetails({ name: "עסק", phone: "12345" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.phone).toBe(SETTINGS.errors.phoneInvalid);

    const empty = validateBusinessDetails({ name: "עסק", phone: "  " });
    expect(empty.ok).toBe(true);
  });

  it("accepts a valid Israeli phone and normalizes optional empties to undefined", () => {
    const r = validateBusinessDetails({
      name: "עסק",
      phone: "0501234567",
      city: "",
      description: "  ",
      addressNote: "ליד הכניסה",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.phone).toBe("0501234567");
      expect(r.value.city).toBeUndefined();
      expect(r.value.description).toBeUndefined();
      expect(r.value.addressNote).toBe("ליד הכניסה");
    }
  });
});

describe("validateCancellationPolicy", () => {
  it("accepts an empty/default policy", () => {
    const r = validateCancellationPolicy({});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.enabled).toBe(false);
      expect(r.value.lateCancellationFeeType).toBe("none");
      expect(r.value.minNoticeHours).toBeUndefined();
    }
  });

  it("parses boolean-ish fields from string 'true'", () => {
    const r = validateCancellationPolicy({
      enabled: "true",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.enabled).toBe(true);
    }
  });

  it("never surfaces a deposit-requirement field", () => {
    const r = validateCancellationPolicy({ enabled: "true" });
    expect(r.ok).toBe(true);
    if (r.ok) expect("requireDepositToBook" in r.value).toBe(false);
  });

  it("rejects a negative minimum notice", () => {
    const r = validateCancellationPolicy({ minNoticeHours: "-1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.minNoticeHours).toBe(SETTINGS.errors.minNoticeInvalid);
  });

  it("rejects a non-numeric minimum notice", () => {
    const r = validateCancellationPolicy({ minNoticeHours: "abc" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.minNoticeHours).toBeTruthy();
  });

  it("rejects late-cancellation hours below 1", () => {
    const r = validateCancellationPolicy({ lateCancellationHours: "0" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.lateCancellationHours).toBeTruthy();
  });

  it("validates fixed fee amount only when feeType=fixed", () => {
    const bad = validateCancellationPolicy({
      lateCancellationFeeType: "fixed",
      lateCancellationFeeAmount: "-5",
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.lateCancellationFeeAmount).toBeTruthy();

    const ok = validateCancellationPolicy({
      lateCancellationFeeType: "fixed",
      lateCancellationFeeAmount: "50",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.lateCancellationFeeAmount).toBe(50);
  });

  it("rejects a percentage outside 0..100", () => {
    const r = validateCancellationPolicy({
      lateCancellationFeeType: "percentage",
      lateCancellationFeePercentage: "150",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.lateCancellationFeePercentage).toBeTruthy();
  });

  it("ignores a fixed fee amount when feeType is not 'fixed'", () => {
    // Amount provided but feeType is percentage → fixed amount is not read.
    const r = validateCancellationPolicy({
      lateCancellationFeeType: "percentage",
      lateCancellationFeeAmount: "-5",
      lateCancellationFeePercentage: "10",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.lateCancellationFeeAmount).toBeUndefined();
      expect(r.value.lateCancellationFeePercentage).toBe(10);
    }
  });
});
