import { describe, it, expect } from "vitest";

import {
  normalizeWhatsAppPhone,
  getBusinessWhatsAppHref,
} from "@/app/b/[slug]/_components/helpers";

describe("normalizeWhatsAppPhone", () => {
  it("converts a local Israeli mobile to international form", () => {
    expect(normalizeWhatsAppPhone("0501234567")).toBe("972501234567");
  });

  it("keeps an already-international number and strips formatting", () => {
    expect(normalizeWhatsAppPhone("+972 50-123 4567")).toBe("972501234567");
    expect(normalizeWhatsAppPhone("(050) 123-4567")).toBe("972501234567");
  });

  it("returns null for empty / invalid input", () => {
    expect(normalizeWhatsAppPhone(null)).toBeNull();
    expect(normalizeWhatsAppPhone(undefined)).toBeNull();
    expect(normalizeWhatsAppPhone("")).toBeNull();
    expect(normalizeWhatsAppPhone("abc")).toBeNull();
    expect(normalizeWhatsAppPhone("123")).toBeNull();
  });
});

describe("getBusinessWhatsAppHref", () => {
  it("builds a wa.me link to the business with a prefilled message", () => {
    const href = getBusinessWhatsAppHref("050-123-4567", "סטודיו יופי");
    expect(href).toContain("https://wa.me/972501234567?text=");
    expect(decodeURIComponent(href!)).toContain("סטודיו יופי");
  });

  it("omits the message when no business name is given", () => {
    expect(getBusinessWhatsAppHref("0501234567")).toBe(
      "https://wa.me/972501234567",
    );
  });

  it("returns null (so callers can hide the action) when the phone is invalid", () => {
    expect(getBusinessWhatsAppHref(null, "סטודיו")).toBeNull();
    expect(getBusinessWhatsAppHref("", "סטודיו")).toBeNull();
    expect(getBusinessWhatsAppHref("not-a-phone", "סטודיו")).toBeNull();
  });
});
