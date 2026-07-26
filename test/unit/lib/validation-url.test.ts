import { describe, it, expect } from "vitest";
import {
  validateHttpsUrl,
  validateImageUrl,
  validateSocialField,
} from "@/lib/validation/url";

/**
 * Owner-supplied URLs are stored and then rendered into <img src> / <a href> on
 * the public business page. The scheme must be pinned to https so a
 * `javascript:` or oversized `data:` value can never reach those attributes, and
 * so the values cannot be silently "fixed up" into something dangerous.
 */
describe("validateHttpsUrl", () => {
  it("accepts an https URL", () => {
    expect(validateHttpsUrl("https://cdn.example.com/a.jpg")).toBe(
      "https://cdn.example.com/a.jpg",
    );
  });

  it("completes a bare domain to https", () => {
    expect(validateHttpsUrl("cdn.example.com/a.jpg")).toBe(
      "https://cdn.example.com/a.jpg",
    );
  });

  it("upgrades http to https rather than storing a downgradeable URL", () => {
    expect(validateHttpsUrl("http://cdn.example.com/a.jpg")).toBeNull();
  });

  it("rejects javascript: instead of prefixing it into something that looks valid", () => {
    expect(validateHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(validateHttpsUrl("JavaScript:alert(1)")).toBeNull();
  });

  it("rejects data: URIs", () => {
    expect(validateHttpsUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBeNull();
  });

  // Any https host is permitted by design (owners paste their own CDN links), so
  // odd spellings are normalised rather than rejected — the security property
  // being enforced here is the SCHEME, not the host. Tightening to a host
  // allowlist would be a separate product decision.
  it("normalises an extra-slash form to a plain https URL", () => {
    expect(validateHttpsUrl("https:////cdn.example.com/x")).toBe(
      "https://cdn.example.com/x",
    );
  });

  it("rejects an over-long value", () => {
    expect(validateHttpsUrl(`https://a.example/${"x".repeat(2100)}`)).toBeNull();
  });

  it("rejects empty input", () => {
    expect(validateHttpsUrl("")).toBeNull();
    expect(validateHttpsUrl("   ")).toBeNull();
  });
});

describe("validateImageUrl", () => {
  it("applies the same https-only rule", () => {
    expect(validateImageUrl("https://cdn.example.com/a.png")).toBe(
      "https://cdn.example.com/a.png",
    );
    expect(validateImageUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("validateSocialField", () => {
  it("allows a bare handle, which the public page completes", () => {
    expect(validateSocialField("@noa_nails")).toBe("@noa_nails");
    expect(validateSocialField("noa_nails")).toBe("noa_nails");
  });

  it("requires https for anything URL-shaped", () => {
    expect(validateSocialField("https://instagram.com/noa")).toBe(
      "https://instagram.com/noa",
    );
    expect(validateSocialField("instagram.com/noa")).toBe(
      "https://instagram.com/noa",
    );
  });

  it("rejects javascript: even in the handle field", () => {
    expect(validateSocialField("javascript:alert(1)")).toBeNull();
  });

  it("normalises a protocol-relative URL to https rather than leaving it scheme-less", () => {
    expect(validateSocialField("//instagram.com/noa")).toBe(
      "https://instagram.com/noa",
    );
  });
});
