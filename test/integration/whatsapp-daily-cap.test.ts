import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Per-business daily ceiling on outbound WhatsApp (src/server/whatsapp/resolver.ts).
 *
 * In the Allura-managed model WE pay Meta for every message. Before this cap
 * there was no upper bound anywhere: a stolen owner session, an abusive tenant,
 * or a runaway retry loop could send without limit — a direct bill, plus damage
 * to the sender reputation shared by every business on the platform.
 *
 * The cap lives on the resolver because that is the single choke point every
 * send path goes through (manual send, campaigns, morning reminders, review
 * requests, loyalty, booking confirmations). Enforcing it per call site would be
 * the same "remember to add the guard" pattern this pass exists to remove.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  captureError: vi.fn(),
}));

const checkPersistentRateLimit = vi.fn();
vi.mock("@/server/rate-limit/persistent", () => ({
  checkPersistentRateLimit: (...a: unknown[]) =>
    checkPersistentRateLimit(...(a as [])),
  pruneRateLimitCounters: vi.fn(),
}));

import { getWhatsAppProviderForBusiness, DAILY_CAP_REASON } from "@/server/whatsapp/resolver";

const prismaMock = (globalThis as Record<string, unknown>)
  .__prismaMock as { whatsAppConnection: { findUnique: ReturnType<typeof vi.fn> } };

const BUSINESS = "biz_aaaaaaaaaaaaaaaaaaaaaaaa";

const sendParams = {
  businessId: BUSINESS,
  toPhone: "+972501234567",
  fallbackText: "שלום",
  automationRunId: "run_1",
  clientId: "cli_1",
};

beforeEach(() => {
  checkPersistentRateLimit.mockReset();
  // No connection configured → the resolver returns its disabled provider. That
  // is enough to prove the cap wraps whatever provider comes back.
  prismaMock.whatsAppConnection.findUnique.mockResolvedValue(null);
});

describe("outbound WhatsApp daily cap", () => {
  it("checks a per-business bucket, not a global one", async () => {
    checkPersistentRateLimit.mockResolvedValue(true);
    const provider = await getWhatsAppProviderForBusiness(BUSINESS);
    await provider.send(sendParams);

    expect(checkPersistentRateLimit).toHaveBeenCalledOnce();
    const [key, max, windowMs] = checkPersistentRateLimit.mock.calls[0];
    // One noisy tenant must never consume another tenant's allowance.
    expect(key).toBe(`wa:send:${BUSINESS}`);
    expect(max).toBeGreaterThan(0);
    expect(windowMs).toBe(24 * 60 * 60 * 1000);
  });

  it("refuses to send once the cap is reached, with a readable Hebrew reason", async () => {
    checkPersistentRateLimit.mockResolvedValue(false);
    const provider = await getWhatsAppProviderForBusiness(BUSINESS);
    const result = await provider.send(sendParams);

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe(DAILY_CAP_REASON);
    expect(result.providerMessageId).toBeNull();
  });

  it("counts each send attempt separately", async () => {
    checkPersistentRateLimit.mockResolvedValue(true);
    const provider = await getWhatsAppProviderForBusiness(BUSINESS);
    await provider.send(sendParams);
    await provider.send(sendParams);
    await provider.send(sendParams);

    // A provider resolved once and reused for a whole campaign batch must still
    // consume quota per message — otherwise the cap is trivially bypassed by
    // resolving the provider a single time.
    expect(checkPersistentRateLimit).toHaveBeenCalledTimes(3);
  });

  it("keeps the underlying provider's identity for logging", async () => {
    checkPersistentRateLimit.mockResolvedValue(true);
    const provider = await getWhatsAppProviderForBusiness(BUSINESS);
    // The wrapper must be transparent: admin logs and diagnostics key off `name`.
    expect(typeof provider.name).toBe("string");
    expect(provider.name.length).toBeGreaterThan(0);
  });
});
