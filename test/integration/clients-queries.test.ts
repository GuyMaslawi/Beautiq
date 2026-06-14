import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, makeClient, makeBooking } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

import {
  getClients,
  getClientSummary,
  getClientBasic,
  getClientDetail,
} from "@/server/clients/queries";

const tenant = { businessId: BUSINESS_A };

beforeEach(() => resetPrismaMock(prisma));

describe("getClients", () => {
  it("scopes findMany by businessId", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await getClients(tenant);
    const arg = prisma.client.findMany.mock.calls[0][0] as {
      where: { businessId: string };
    };
    expect(arg.where.businessId).toBe(BUSINESS_A);
  });

  it("adds an OR search filter while keeping the businessId scope", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await getClients(tenant, { search: "דנה" });
    const arg = prisma.client.findMany.mock.calls[0][0] as {
      where: { businessId: string; OR?: unknown[] };
    };
    expect(arg.where.businessId).toBe(BUSINESS_A);
    expect(Array.isArray(arg.where.OR)).toBe(true);
  });

  it("derives stats: lastVisit, totalSpent and counts from bookings", async () => {
    const past = new Date("2026-05-01T09:00:00Z");
    const future = new Date("2099-01-01T09:00:00Z");
    prisma.client.findMany.mockResolvedValue([
      makeClient({
        id: "cli_1",
        bookings: [
          {
            id: "b1",
            status: "completed",
            startTime: past,
            priceSnapshot: 150,
            service: { name: "מניקור" },
          },
          {
            id: "b2",
            status: "approved",
            startTime: future,
            priceSnapshot: 200,
            service: { name: "פדיקור" },
          },
          {
            id: "b3",
            status: "no_show",
            startTime: past,
            priceSnapshot: 0,
            service: { name: "x" },
          },
          {
            id: "b4",
            status: "cancelled",
            startTime: past,
            priceSnapshot: 0,
            service: { name: "y" },
          },
        ],
      }),
    ]);

    const res = await getClients(tenant);
    expect(res).toHaveLength(1);
    expect(res[0].totalBookings).toBe(4);
    expect(res[0].noShowCount).toBe(1);
    expect(res[0].cancellationCount).toBe(1);
    expect(res[0].totalSpent).toBe(150);
    expect(res[0].lastVisitAt).toEqual(past);
    expect(res[0].upcomingBooking?.serviceName).toBe("פדיקור");
  });
});

describe("getClientSummary", () => {
  it("scopes every count query by businessId", async () => {
    prisma.client.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    const res = await getClientSummary(tenant);
    expect(res).toEqual({ total: 10, withUpcoming: 3, withNoShow: 1, notReturned: 2 });
    expect(prisma.client.count).toHaveBeenCalledTimes(4);
    for (const call of prisma.client.count.mock.calls) {
      const arg = call[0] as { where: { businessId: string } };
      expect(arg.where.businessId).toBe(BUSINESS_A);
    }
  });
});

describe("getClientBasic", () => {
  it("uses a scoped findFirst and returns null for a cross-tenant id", async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    const res = await getClientBasic(tenant, "cli_other");
    expect(res).toBeNull();
    const arg = prisma.client.findFirst.mock.calls[0][0] as {
      where: { id: string; businessId: string };
    };
    expect(arg.where).toEqual(
      expect.objectContaining({ id: "cli_other", businessId: BUSINESS_A }),
    );
  });

  it("returns the basic client when found", async () => {
    prisma.client.findFirst.mockResolvedValue({
      id: "cli_1",
      fullName: "דנה",
      phone: "050",
    });
    const res = await getClientBasic(tenant, "cli_1");
    expect(res?.id).toBe("cli_1");
  });
});

describe("getClientDetail", () => {
  it("returns null (scoped) when the client belongs to another business", async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    const res = await getClientDetail(tenant, "cli_other");
    expect(res).toBeNull();
    const arg = prisma.client.findFirst.mock.calls[0][0] as {
      where: { businessId: string };
    };
    expect(arg.where.businessId).toBe(BUSINESS_A);
  });

  it("maps bookings + stats and surfaces opt-in / unsubscribed fields", async () => {
    const past = new Date("2026-05-01T09:00:00Z");
    const unsub = new Date("2026-06-01T00:00:00Z");
    prisma.client.findFirst.mockResolvedValue(
      makeClient({
        id: "cli_1",
        whatsappOptIn: false,
        marketingOptIn: true,
        unsubscribedAt: unsub,
        bookings: [
          makeBooking({
            id: "b1",
            status: "completed",
            startTime: past,
            endTime: past,
            priceSnapshot: 150,
            durationMinutesSnapshot: 60,
            depositStatus: "paid",
            service: { id: "svc_1", name: "מניקור" },
          }),
        ],
      }),
    );

    const res = await getClientDetail(tenant, "cli_1");
    expect(res?.unsubscribedAt).toEqual(unsub);
    expect(res?.whatsappOptIn).toBe(false);
    expect(res?.marketingOptIn).toBe(true);
    expect(res?.stats.completedBookings).toBe(1);
    expect(res?.stats.totalSpent).toBe(150);
    expect(res?.bookings[0].service.name).toBe("מניקור");
  });
});
