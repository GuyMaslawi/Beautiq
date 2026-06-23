import { describe, it, expect } from "vitest";
import { validateBusinessDetails } from "@/lib/validation/settings";
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

