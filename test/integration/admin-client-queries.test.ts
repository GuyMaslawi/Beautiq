import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, makeClient } from "../helpers/factories";

/**
 * Admin cross-tenant client queries (server/admin/client-queries.ts).
 *
 * Read-only platform-admin list/detail. We assert the search-filter shape, the
 * mapping into AdminClientListItem (including lastBookingAt from the most recent
 * completed booking), the 300-row cap, and the by-id lookup.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

beforeEach(() => {
  resetPrismaMock(prisma);
});

import {
  getAdminClients,
  getAdminClientById,
  getAdminBusinessClients,
} from "@/server/admin/client-queries";

function rowFor(overrides: Record<string, unknown> = {}) {
  return {
    ...makeClient(overrides),
    email: "x@y.com",
    business: { id: BUSINESS_A, name: "סטודיו יופי" },
    bookings: [{ startTime: new Date("2026-05-01T10:00:00Z") }],
  };
}

describe("getAdminClients", () => {
  it("returns an empty (undefined) where when no search term is given, capped at 300", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    const res = await getAdminClients();
    expect(res).toEqual([]);
    const arg = prisma.client.findMany.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.where).toBeUndefined();
    expect(arg.take).toBe(300);
    expect(arg.orderBy).toEqual({ createdAt: "desc" });
  });

  it("builds a search OR across name/phone/normalizedPhone/business name", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await getAdminClients({ q: "עדי" });
    const arg = prisma.client.findMany.mock.calls[0][0] as { where: { OR: unknown[] } };
    expect(arg.where.OR).toHaveLength(4);
  });

  it("maps rows to AdminClientListItem with businessName and lastBookingAt", async () => {
    const lastBooking = new Date("2026-05-01T10:00:00Z");
    prisma.client.findMany.mockResolvedValue([
      rowFor({ id: "cli_1", fullName: "דנה", notes: "VIP" }),
    ]);
    const res = await getAdminClients({ q: "דנה" });
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      id: "cli_1",
      fullName: "דנה",
      businessId: BUSINESS_A,
      businessName: "סטודיו יופי",
      notes: "VIP",
      lastBookingAt: lastBooking,
    });
  });

  it("sets lastBookingAt to null when the client has no completed bookings", async () => {
    prisma.client.findMany.mockResolvedValue([
      { ...rowFor({ id: "cli_2" }), bookings: [] },
    ]);
    const res = await getAdminClients();
    expect(res[0].lastBookingAt).toBeNull();
  });
});

describe("getAdminBusinessClients", () => {
  it("always scopes the query to the given businessId (no cross-tenant leak)", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await getAdminBusinessClients(BUSINESS_A);
    const arg = prisma.client.findMany.mock.calls[0][0] as {
      where: { businessId: string };
      take: number;
    };
    expect(arg.where.businessId).toBe(BUSINESS_A);
    expect(arg.take).toBe(500);
  });

  it("adds a search OR over name/phone/email while keeping the businessId scope", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await getAdminBusinessClients(BUSINESS_A, "דנה");
    const arg = prisma.client.findMany.mock.calls[0][0] as {
      where: { businessId: string; OR: unknown[] };
    };
    expect(arg.where.businessId).toBe(BUSINESS_A);
    expect(arg.where.OR).toHaveLength(4);
  });

  it("ignores a blank search term", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await getAdminBusinessClients(BUSINESS_A, "   ");
    const arg = prisma.client.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(arg.where.OR).toBeUndefined();
  });

  it("maps rows including totals, lastBookingAt, and numeric totalSpent", async () => {
    prisma.client.findMany.mockResolvedValue([
      {
        ...makeClient({ id: "cli_1", fullName: "דנה" }),
        email: "d@x.com",
        totalBookings: 4,
        totalSpent: "350.5",
        unsubscribedAt: null,
        bookings: [{ startTime: new Date("2026-05-01T10:00:00Z") }],
      },
    ]);
    const res = await getAdminBusinessClients(BUSINESS_A);
    expect(res[0]).toMatchObject({
      id: "cli_1",
      fullName: "דנה",
      totalBookings: 4,
      totalSpent: 350.5,
      lastBookingAt: new Date("2026-05-01T10:00:00Z"),
    });
  });
});

describe("getAdminClientById", () => {
  it("looks up the client by id with its business name", async () => {
    prisma.client.findUnique.mockResolvedValue({
      ...makeClient({ id: "cli_9" }),
      business: { id: BUSINESS_A, name: "סטודיו" },
    });
    const res = await getAdminClientById("cli_9");
    expect(res!.id).toBe("cli_9");
    const arg = prisma.client.findUnique.mock.calls[0][0] as { where: { id: string } };
    expect(arg.where).toEqual({ id: "cli_9" });
  });

  it("returns null when not found", async () => {
    prisma.client.findUnique.mockResolvedValue(null);
    const res = await getAdminClientById("missing");
    expect(res).toBeNull();
  });
});
