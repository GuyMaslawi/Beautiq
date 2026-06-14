import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>).__prismaMock as ReturnType<
  typeof createPrismaMock
>;

import { getBlockedClientsByReason } from "@/server/win-back-automation/blocked-clients";

const TENANT = { businessId: BUSINESS_A };
const OPTIONS = { thresholdDays: 45, cooldownDays: 30, requireOptIn: true };

const NOW = Date.now();
const OLD_COMPLETED = {
  status: "completed",
  startTime: new Date(NOW - 90 * 24 * 60 * 60 * 1000),
};
const FUTURE_APPROVED = {
  status: "approved",
  startTime: new Date(NOW + 5 * 24 * 60 * 60 * 1000),
};

/** Minimal client row as selected by getBlockedClientsByReason. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "cli",
    fullName: "לקוחה",
    phone: "050-000-0000",
    normalizedPhone: "+972500000000",
    whatsappOptIn: true,
    marketingOptIn: true,
    unsubscribedAt: null,
    bookings: [OLD_COMPLETED],
    automationMessages: [],
    ...overrides,
  };
}

beforeEach(() => resetPrismaMock(prisma));

describe("getBlockedClientsByReason — tenant scoping", () => {
  it("scopes the findMany and its nested relations to the businessId", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await getBlockedClientsByReason(TENANT, OPTIONS);
    const arg = prisma.client.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ businessId: BUSINESS_A });
    expect(arg.select.bookings.where).toEqual({ businessId: BUSINESS_A });
    expect(arg.select.automationMessages.where).toMatchObject({
      businessId: BUSINESS_A,
      type: "win_back",
    });
  });
});

describe("getBlockedClientsByReason — priority bucketing", () => {
  it("buckets each client into exactly one priority reason", async () => {
    prisma.client.findMany.mockResolvedValue([
      row({ id: "invalid", normalizedPhone: "bad" }),
      row({ id: "unsub", unsubscribedAt: new Date() }),
      row({ id: "nooptin", whatsappOptIn: false }),
      row({ id: "nomarketing", marketingOptIn: false }),
      row({ id: "future", bookings: [OLD_COMPLETED, FUTURE_APPROVED] }),
      row({ id: "cooldown", automationMessages: [{ id: "m1" }] }),
      row({ id: "nocompleted", bookings: [] }),
      row({ id: "eligible" }),
    ]);

    const result = await getBlockedClientsByReason(TENANT, OPTIONS);

    expect(result.counts.invalidPhone).toBe(1);
    expect(result.counts.unsubscribed).toBe(1);
    expect(result.counts.noOptIn).toBe(1);
    expect(result.counts.noMarketingOptIn).toBe(1);
    expect(result.counts.hasFutureBooking).toBe(1);
    expect(result.counts.inCooldown).toBe(1);
    expect(result.counts.noCompletedBooking).toBe(1);
    expect(result.counts.eligible).toBe(1);
    expect(result.counts.total).toBe(8);

    // each non-eligible reason has a masked preview
    expect(result.invalidPhone[0].maskedPhone).toBe("****");
    expect(result.unsubscribed[0].id).toBe("unsub");
  });

  it("invalidPhone has the highest priority (overrides unsubscribed)", async () => {
    prisma.client.findMany.mockResolvedValue([
      row({ id: "x", normalizedPhone: "", unsubscribedAt: new Date() }),
    ]);
    const result = await getBlockedClientsByReason(TENANT, OPTIONS);
    expect(result.counts.invalidPhone).toBe(1);
    expect(result.counts.unsubscribed).toBe(0);
  });

  it("does not apply the noOptIn bucket when requireOptIn=false", async () => {
    prisma.client.findMany.mockResolvedValue([row({ whatsappOptIn: false })]);
    const result = await getBlockedClientsByReason(TENANT, {
      ...OPTIONS,
      requireOptIn: false,
    });
    expect(result.counts.noOptIn).toBe(0);
    expect(result.counts.eligible).toBe(1);
  });

  it("treats cooldown clients as eligible when ignoreCooldown=true", async () => {
    prisma.client.findMany.mockResolvedValue([
      row({ automationMessages: [{ id: "m1" }] }),
    ]);
    const result = await getBlockedClientsByReason(TENANT, {
      ...OPTIONS,
      ignoreCooldown: true,
    });
    expect(result.counts.inCooldown).toBe(0);
    expect(result.counts.eligible).toBe(1);
  });
});
