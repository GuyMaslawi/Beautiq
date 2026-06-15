import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { BUSINESS_A, BUSINESS_B } from "../helpers/factories";

/**
 * Multi-tenant scoping smoke tests for the read subsystems that were previously
 * at 0% coverage. For each subsystem we prove the three things that matter
 * (CLAUDE.md §10):
 *   1. the query is scoped by the current businessId,
 *   2. Business A and Business B resolve to DIFFERENT scopes (no cross-tenant read),
 *   3. an empty database returns a safe value,
 * and — where the query joins client rows — that the returned DTO never leaks
 * internal/private fields (notes, normalizedPhone, whatsappOptIn, ...).
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof import("../helpers/prisma-mock").createPrismaMock>;

import { resetPrismaMock } from "../helpers/prisma-mock";
import { getAtRiskClients, getAtRiskSummary } from "@/server/at-risk/queries";
import { getBringBackClients } from "@/server/bring-back/queries";
import { getEmptySlotsData } from "@/server/empty-slots/queries";
import { getGuidanceData } from "@/server/guidance/queries";
import {
  getComposerData,
  getSystemTemplates,
  resolveTemplate,
} from "@/server/messages/queries";
import {
  getReputationBookings,
  getReputationSummary,
  getClientLatestCompletedBooking,
} from "@/server/reputation/queries";
import { getRetentionClients, getRetentionSummary } from "@/server/retention/queries";
import { getWinBackAllCampaigns } from "@/server/win-back-campaigns/queries";

const A = { businessId: BUSINESS_A };
const B = { businessId: BUSINESS_B };

// Internal/private fields that must never appear in a returned client DTO.
const PRIVATE_FIELDS = ["notes", "normalizedPhone", "whatsappOptIn", "marketingOptIn"];

// A raw client row (as Prisma would return) that deliberately CARRIES private
// fields — used to prove the mapping strips them.
function rawClientWithBookings(extra: Record<string, unknown> = {}) {
  return {
    id: "cli_1",
    fullName: "דנה",
    phone: "050-123-4567",
    notes: "SECRET internal note",
    normalizedPhone: "+972501234567",
    whatsappOptIn: true,
    marketingOptIn: false,
    lastVisitAt: new Date("2026-01-01T00:00:00Z"),
    bookings: [
      {
        status: "completed",
        startTime: new Date("2026-01-01T09:00:00Z"),
        priceSnapshot: new Prisma.Decimal(200),
        service: { name: "טיפול" },
      },
    ],
    ...extra,
  };
}

function assertNoPrivateFields(obj: Record<string, unknown>) {
  for (const f of PRIVATE_FIELDS) expect(obj).not.toHaveProperty(f);
}

beforeEach(() => resetPrismaMock(prisma));

describe("at-risk", () => {
  it("scopes by businessId, differs per tenant, and is empty-safe", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    expect(await getAtRiskClients(A)).toEqual([]);
    expect(prisma.client.findMany.mock.calls[0][0].where.businessId).toBe(BUSINESS_A);

    await getAtRiskClients(B);
    expect(prisma.client.findMany.mock.calls[1][0].where.businessId).toBe(BUSINESS_B);
  });

  it("returns a DTO that strips private client fields", async () => {
    prisma.client.findMany.mockResolvedValue([rawClientWithBookings()]);
    const [client] = await getAtRiskClients(A);
    expect(client.fullName).toBe("דנה");
    assertNoPrivateFields(client as unknown as Record<string, unknown>);
  });

  it("summary is empty-safe", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    expect(await getAtRiskSummary(A)).toEqual({ total: 0, critical: 0, high: 0, medium: 0 });
  });
});

describe("bring-back", () => {
  it("scopes by businessId and strips private fields", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    expect(await getBringBackClients(A)).toEqual([]);
    expect(prisma.client.findMany.mock.calls[0][0].where.businessId).toBe(BUSINESS_A);

    prisma.client.findMany.mockResolvedValue([rawClientWithBookings()]);
    const [client] = await getBringBackClients(B);
    expect(prisma.client.findMany.mock.calls[1][0].where.businessId).toBe(BUSINESS_B);
    assertNoPrivateFields(client as unknown as Record<string, unknown>);
  });
});

describe("empty-slots", () => {
  it("scopes every parallel query by businessId and is empty-safe (no services → no slots)", async () => {
    prisma.service.findMany.mockResolvedValue([]);
    prisma.availabilityRule.findMany.mockResolvedValue([]);
    prisma.availabilityException.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.client.findMany.mockResolvedValue([]);

    const res = await getEmptySlotsData(A);
    expect(res).toEqual({ slots: [], suggestedClients: [] });

    expect(prisma.service.findMany.mock.calls[0][0].where.businessId).toBe(BUSINESS_A);
    expect(prisma.availabilityRule.findMany.mock.calls[0][0].where.businessId).toBe(BUSINESS_A);
    expect(prisma.booking.findMany.mock.calls[0][0].where.businessId).toBe(BUSINESS_A);
    expect(prisma.client.findMany.mock.calls[0][0].where.businessId).toBe(BUSINESS_A);
  });

  it("uses a different scope for a different tenant", async () => {
    prisma.service.findMany.mockResolvedValue([]);
    prisma.availabilityRule.findMany.mockResolvedValue([]);
    prisma.availabilityException.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.client.findMany.mockResolvedValue([]);
    await getEmptySlotsData(B);
    expect(prisma.service.findMany.mock.calls[0][0].where.businessId).toBe(BUSINESS_B);
  });
});

describe("guidance", () => {
  it("scopes all counts by businessId and returns a safe zeroed summary", async () => {
    prisma.service.count.mockResolvedValue(0);
    prisma.availabilityRule.count.mockResolvedValue(0);
    prisma.booking.count.mockResolvedValue(0);
    prisma.client.count.mockResolvedValue(0);
    prisma.service.findMany.mockResolvedValue([]); // pricing concern subset

    const res = await getGuidanceData(A);
    expect(res.activeServicesCount).toBe(0);
    expect(res.pendingDepositCount).toBe(0);
    expect(res.pricingConcernCount).toBe(0);

    for (const call of prisma.booking.count.mock.calls) {
      expect(call[0].where.businessId).toBe(BUSINESS_A);
    }
    for (const call of prisma.client.count.mock.calls) {
      expect(call[0].where.businessId).toBe(BUSINESS_A);
    }
  });
});

describe("messages", () => {
  it("getComposerData scopes bookings + clients by businessId and is empty-safe", async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.client.findMany.mockResolvedValue([]);
    const res = await getComposerData(A);
    expect(res).toEqual({ bookingOptions: [], clientOptions: [] });
    expect(prisma.booking.findMany.mock.calls[0][0].where.businessId).toBe(BUSINESS_A);
    expect(prisma.client.findMany.mock.calls[0][0].where.businessId).toBe(BUSINESS_A);
    // client selector only fetches public-safe fields
    expect(prisma.client.findMany.mock.calls[0][0].select).toEqual({
      id: true,
      fullName: true,
      phone: true,
    });
  });

  it("getSystemTemplates reads global (business-agnostic) active templates only", async () => {
    prisma.systemMessageTemplate.findMany.mockResolvedValue([]);
    await getSystemTemplates();
    expect(prisma.systemMessageTemplate.findMany.mock.calls[0][0].where).toEqual({
      isActive: true,
    });
  });

  it("resolveTemplate looks the business override up by the scoped composite key", async () => {
    prisma.messageTemplate.findUnique.mockResolvedValue(null);
    prisma.systemMessageTemplate.findUnique.mockResolvedValue({
      isActive: true,
      body: "fallback",
    });
    const res = await resolveTemplate(A, "booking_confirmation");
    expect(res).toBe("fallback");
    expect(prisma.messageTemplate.findUnique.mock.calls[0][0].where).toEqual({
      businessId_type: { businessId: BUSINESS_A, type: "booking_confirmation" },
    });
  });
});

describe("reputation", () => {
  it("bookings list is scoped + empty-safe and strips client PII to a DTO", async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    expect(await getReputationBookings(A)).toEqual([]);
    expect(prisma.booking.findMany.mock.calls[0][0].where.businessId).toBe(BUSINESS_A);
    expect(prisma.booking.findMany.mock.calls[0][0].where.status).toBe("completed");
  });

  it("summary count is scoped by businessId", async () => {
    prisma.booking.count.mockResolvedValue(0);
    expect(await getReputationSummary(B)).toEqual({ recentCompletedCount: 0 });
    expect(prisma.booking.count.mock.calls[0][0].where.businessId).toBe(BUSINESS_B);
  });

  it("latest-completed lookup is scoped by businessId + clientId and null-safe", async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    expect(await getClientLatestCompletedBooking(A, "cli_9")).toBeNull();
    const where = prisma.booking.findFirst.mock.calls[0][0].where;
    expect(where.businessId).toBe(BUSINESS_A);
    expect(where.clientId).toBe("cli_9");
  });
});

describe("retention", () => {
  it("clients list is scoped, empty-safe, and strips private fields", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    expect(await getRetentionClients(A)).toEqual([]);
    expect(prisma.client.findMany.mock.calls[0][0].where.businessId).toBe(BUSINESS_A);

    prisma.client.findMany.mockResolvedValue([rawClientWithBookings()]);
    const [client] = await getRetentionClients(A);
    assertNoPrivateFields(client as unknown as Record<string, unknown>);
  });

  it("summary counts are scoped by businessId", async () => {
    prisma.client.count.mockResolvedValue(0);
    expect(await getRetentionSummary(B)).toEqual({
      notReturnedCount: 0,
      withUpcomingCount: 0,
    });
    for (const call of prisma.client.count.mock.calls) {
      expect(call[0].where.businessId).toBe(BUSINESS_B);
    }
  });
});

describe("win-back-campaigns", () => {
  it("scopes by businessId, is empty-safe across all campaign buckets", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    const res = await getWinBackAllCampaigns(A);
    expect(res).toEqual({ "30": [], "60": [], "90": [], vip: [] });
    expect(prisma.client.findMany.mock.calls[0][0].where.businessId).toBe(BUSINESS_A);
  });

  it("buckets clients by recency and strips private fields", async () => {
    // last completed ~120 days ago → "90" bucket
    const longAgo = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    prisma.client.findMany.mockResolvedValue([
      rawClientWithBookings({
        bookings: [
          {
            status: "completed",
            startTime: longAgo,
            priceSnapshot: new Prisma.Decimal(200),
            service: { name: "טיפול" },
          },
        ],
      }),
    ]);
    const res = await getWinBackAllCampaigns(B);
    expect(prisma.client.findMany.mock.calls[0][0].where.businessId).toBe(BUSINESS_B);
    expect(res["90"]).toHaveLength(1);
    assertNoPrivateFields(res["90"][0] as unknown as Record<string, unknown>);
  });
});
