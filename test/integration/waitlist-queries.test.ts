import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

import {
  getWaitlistEntries,
  getActiveWaitlistCount,
  getWaitlistMatchesForBooking,
} from "@/server/waitlist/queries";

const TENANT = { businessId: BUSINESS_A };

beforeEach(() => resetPrismaMock(prisma));

/** Build a raw waitlistEntry row (as Prisma include-shape) for the mock. */
function entryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "wl_1",
    businessId: BUSINESS_A,
    status: "active",
    preferredFrom: null,
    preferredTo: null,
    notes: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    client: { id: "cli_1", fullName: "עדי לוי", phone: "050-1234567" },
    service: { id: "svc_1", name: "מניקור" },
    serviceId: "svc_1",
    ...overrides,
  };
}

describe("getWaitlistEntries", () => {
  it("scopes findMany to the tenant and orders by createdAt desc", async () => {
    prisma.waitlistEntry.findMany.mockResolvedValue([]);
    const res = await getWaitlistEntries(TENANT);
    expect(res).toEqual([]);
    expect(prisma.waitlistEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: BUSINESS_A },
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("maps rows and ranks active before notified before terminal statuses", async () => {
    prisma.waitlistEntry.findMany.mockResolvedValue([
      entryRow({ id: "a", status: "cancelled" }),
      entryRow({ id: "b", status: "notified" }),
      entryRow({ id: "c", status: "active" }),
      entryRow({ id: "d", status: "booked" }),
    ]);
    const res = await getWaitlistEntries(TENANT);
    expect(res.map((e) => e.id)).toEqual(["c", "b", "a", "d"]);
    // mapping check
    const first = res[0];
    expect(first.clientName).toBe("עדי לוי");
    expect(first.clientPhone).toBe("050-1234567");
    expect(first.serviceId).toBe("svc_1");
    expect(first.serviceName).toBe("מניקור");
  });

  it("maps null service to null serviceId/serviceName", async () => {
    prisma.waitlistEntry.findMany.mockResolvedValue([
      entryRow({ service: null, serviceId: null }),
    ]);
    const res = await getWaitlistEntries(TENANT);
    expect(res[0].serviceId).toBeNull();
    expect(res[0].serviceName).toBeNull();
  });
});

describe("getActiveWaitlistCount", () => {
  it("counts only active entries scoped to the tenant", async () => {
    prisma.waitlistEntry.count.mockResolvedValue(4);
    const res = await getActiveWaitlistCount(TENANT);
    expect(res).toBe(4);
    expect(prisma.waitlistEntry.count).toHaveBeenCalledWith({
      where: { businessId: BUSINESS_A, status: "active" },
    });
  });
});

describe("getWaitlistMatchesForBooking", () => {
  it("queries active entries scoped by tenant, service-or-flexible, oldest first", async () => {
    prisma.waitlistEntry.findMany.mockResolvedValue([]);
    await getWaitlistMatchesForBooking(TENANT, {
      serviceId: "svc_1",
      startTime: new Date("2026-07-01T11:00:00Z"),
    });
    expect(prisma.waitlistEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId: BUSINESS_A,
          status: "active",
          OR: [{ serviceId: null }, { serviceId: "svc_1" }],
        },
        orderBy: { createdAt: "asc" },
      }),
    );
  });

  it("handles a booking with null serviceId (undefined in OR clause)", async () => {
    prisma.waitlistEntry.findMany.mockResolvedValue([]);
    await getWaitlistMatchesForBooking(TENANT, {
      serviceId: null,
      startTime: new Date("2026-07-01T11:00:00Z"),
    });
    const arg = prisma.waitlistEntry.findMany.mock.calls[0][0] as {
      where: { OR: Array<{ serviceId: unknown }> };
    };
    expect(arg.where.OR).toEqual([{ serviceId: null }, { serviceId: undefined }]);
  });

  it("flags a strong match when service is exact and slot falls in the preferred window", async () => {
    // booking startTime 11:00 UTC => 14:00 Jerusalem (summer +3). Window 13:00-15:00 Jerusalem.
    prisma.waitlistEntry.findMany.mockResolvedValue([
      entryRow({
        id: "strong",
        serviceId: "svc_1",
        preferredFrom: new Date("2026-07-01T10:00:00Z"), // 13:00 JLM
        preferredTo: new Date("2026-07-01T12:00:00Z"), // 15:00 JLM
      }),
    ]);
    const res = await getWaitlistMatchesForBooking(TENANT, {
      serviceId: "svc_1",
      startTime: new Date("2026-07-01T11:00:00Z"),
    });
    expect(res[0].isStrongMatch).toBe(true);
  });

  it("is not a strong match when the slot is outside the preferred window", async () => {
    prisma.waitlistEntry.findMany.mockResolvedValue([
      entryRow({
        id: "outside",
        serviceId: "svc_1",
        preferredFrom: new Date("2026-07-01T05:00:00Z"), // 08:00 JLM
        preferredTo: new Date("2026-07-01T06:00:00Z"), // 09:00 JLM
      }),
    ]);
    const res = await getWaitlistMatchesForBooking(TENANT, {
      serviceId: "svc_1",
      startTime: new Date("2026-07-01T11:00:00Z"), // 14:00 JLM
    });
    expect(res[0].isStrongMatch).toBe(false);
  });

  it("is not a strong match when the service does not exactly match (flexible entry)", async () => {
    prisma.waitlistEntry.findMany.mockResolvedValue([
      entryRow({ id: "flex", serviceId: null, service: null }),
    ]);
    const res = await getWaitlistMatchesForBooking(TENANT, {
      serviceId: "svc_1",
      startTime: new Date("2026-07-01T11:00:00Z"),
    });
    expect(res[0].isStrongMatch).toBe(false);
    expect(res[0].serviceId).toBeNull();
  });

  it("treats entries with no preferred window as time-OK and sorts strong matches first then oldest", async () => {
    prisma.waitlistEntry.findMany.mockResolvedValue([
      entryRow({
        id: "weak_old",
        serviceId: null,
        service: null,
        createdAt: new Date("2026-05-01T00:00:00Z"),
      }),
      entryRow({
        id: "strong_new",
        serviceId: "svc_1",
        preferredFrom: null,
        preferredTo: null,
        createdAt: new Date("2026-06-01T00:00:00Z"),
      }),
    ]);
    const res = await getWaitlistMatchesForBooking(TENANT, {
      serviceId: "svc_1",
      startTime: new Date("2026-07-01T11:00:00Z"),
    });
    expect(res.map((e) => e.id)).toEqual(["strong_new", "weak_old"]);
  });

  it("breaks ties between equally-strong matches by longest-waiting (oldest createdAt) first", async () => {
    // Both flexible-on-service => both weak; tie-break must put the older entry first.
    prisma.waitlistEntry.findMany.mockResolvedValue([
      entryRow({
        id: "newer",
        serviceId: null,
        service: null,
        createdAt: new Date("2026-06-10T00:00:00Z"),
      }),
      entryRow({
        id: "older",
        serviceId: null,
        service: null,
        createdAt: new Date("2026-06-01T00:00:00Z"),
      }),
    ]);
    const res = await getWaitlistMatchesForBooking(TENANT, {
      serviceId: "svc_1",
      startTime: new Date("2026-07-01T11:00:00Z"),
    });
    expect(res.map((e) => e.id)).toEqual(["older", "newer"]);
  });
});
