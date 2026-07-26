import { describe, it, expect } from "vitest";
import { secretEquals, bearerEquals } from "@/lib/secret-compare";

/**
 * These helpers guard cron execution, the payment webhook and the Meta webhook
 * verification. The property that matters most is that they fail CLOSED: a
 * missing or empty secret must never be treated as a match, because that turns
 * "the env var isn't configured" into "everyone is authorized".
 */
describe("secretEquals", () => {
  it("matches identical secrets", () => {
    expect(secretEquals("s3cret-value", "s3cret-value")).toBe(true);
  });

  it("rejects different secrets, including a prefix of the real one", () => {
    expect(secretEquals("s3cret-valu", "s3cret-value")).toBe(false);
    expect(secretEquals("s3cret-valuX", "s3cret-value")).toBe(false);
    expect(secretEquals("totally-different", "s3cret-value")).toBe(false);
  });

  it("fails closed on a missing or empty secret", () => {
    expect(secretEquals(null, "s3cret")).toBe(false);
    expect(secretEquals("s3cret", null)).toBe(false);
    expect(secretEquals(undefined, undefined)).toBe(false);
    expect(secretEquals("", "")).toBe(false);
    expect(secretEquals("s3cret", "")).toBe(false);
  });

  it("compares by value, not by length (differing lengths are not an error)", () => {
    expect(secretEquals("short", "a-much-longer-secret")).toBe(false);
  });
});

describe("bearerEquals", () => {
  it("accepts a correct Bearer header", () => {
    expect(bearerEquals("Bearer abc123", "abc123")).toBe(true);
  });

  it("rejects a wrong token, a missing header, or a bare token", () => {
    expect(bearerEquals("Bearer wrong", "abc123")).toBe(false);
    expect(bearerEquals(null, "abc123")).toBe(false);
    expect(bearerEquals("abc123", "abc123")).toBe(false);
  });

  it("fails closed when the secret is not configured", () => {
    expect(bearerEquals("Bearer anything", undefined)).toBe(false);
    expect(bearerEquals("Bearer anything", "")).toBe(false);
  });
});
