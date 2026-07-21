import { describe, it, expect } from "vitest";
import { parseCallback, isGrowConfigured } from "@/lib/subscription/grow";

/**
 * Grow server-to-server callback parsing — the security-critical bit. The
 * webhook trusts this to decide whether a plan is paid, so it must only report
 * `paid` on a genuine approved status and must surface processId/token/nonce
 * exactly for authentication.
 */
describe("parseCallback", () => {
  it("returns null when process identifiers are missing", () => {
    expect(parseCallback({})).toBeNull();
    expect(parseCallback({ data: { processToken: "t" } })).toBeNull();
    expect(parseCallback({ data: { processId: "1" } })).toBeNull();
  });

  it("parses an approved charge (statusCode 2) from a nested data object", () => {
    const event = parseCallback({
      data: {
        processId: "12345",
        processToken: "ptok",
        cField1: "nonce-abc",
        transactionId: "tx-9",
        cardToken: "card-tok",
        cardSuffix: "4242",
        sum: "149.00",
        statusCode: "2",
      },
    });
    expect(event).not.toBeNull();
    expect(event).toMatchObject({
      processId: "12345",
      processToken: "ptok",
      nonce: "nonce-abc",
      paid: true,
      transactionId: "tx-9",
      cardToken: "card-tok",
      cardSuffix: "4242",
      sumMinor: 14900,
    });
  });

  it("does NOT mark unapproved statuses as paid", () => {
    const event = parseCallback({
      data: { processId: "1", processToken: "t", statusCode: "0" },
    });
    expect(event?.paid).toBe(false);
  });

  it("reads identifiers from a flat (non-nested) payload too", () => {
    const event = parseCallback({
      processId: "77",
      processToken: "flat-token",
      statusCode: "2",
      sum: 249,
    });
    expect(event).toMatchObject({ processId: "77", paid: true, sumMinor: 24900 });
  });
});

describe("isGrowConfigured", () => {
  it("is false without the feature flag and merchant identifiers", () => {
    // Tests never set SUBSCRIPTIONS_ENABLED / GROW_* — must resolve to false so
    // the checkout falls back to the safe dev activation and never hits Grow.
    expect(isGrowConfigured()).toBe(false);
  });
});
