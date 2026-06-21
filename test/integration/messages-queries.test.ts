import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";
import { Prisma } from "@prisma/client";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

import {
  getSystemTemplates,
  getComposerData,
  resolveTemplate,
} from "@/server/messages/queries";

const tenant = { businessId: BUSINESS_A };

beforeEach(() => resetPrismaMock(prisma));

describe("getSystemTemplates", () => {
  it("returns only active system templates ordered by createdAt asc", async () => {
    prisma.systemMessageTemplate.findMany.mockResolvedValue([{ id: "t1" }]);
    const res = await getSystemTemplates();
    expect(res).toEqual([{ id: "t1" }]);
    expect(prisma.systemMessageTemplate.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
  });
});

describe("getComposerData", () => {
  it("scopes bookings + clients by business and maps booking/client options", async () => {
    prisma.booking.findMany.mockResolvedValue([
      {
        id: "bkg_1",
        startTime: new Date("2026-07-01T09:30:00Z"),
        priceSnapshot: new Prisma.Decimal(150),
        client: { fullName: "דנה" },
        service: { name: "מניקור" },
      },
    ]);
    prisma.client.findMany.mockResolvedValue([
      { id: "cli_1", fullName: "דנה", phone: "050-123-4567" },
      { id: "cli_2", fullName: "נועה", phone: null },
    ]);

    const res = await getComposerData(tenant);

    expect(res.bookingOptions).toHaveLength(1);
    expect(res.bookingOptions[0]).toMatchObject({
      id: "bkg_1",
      clientName: "דנה",
      serviceName: "מניקור",
    });
    expect(res.bookingOptions[0].price).toContain("₪");

    // client with phone shows it in label; client without phone shows just name
    expect(res.clientOptions[0].label).toContain("050-123-4567");
    expect(res.clientOptions[1].label).toBe("נועה");

    // scoping + filters
    const bookingArg = prisma.booking.findMany.mock.calls[0][0] as {
      where: { businessId: string; status: { notIn: string[] } };
      take: number;
    };
    expect(bookingArg.where.businessId).toBe(BUSINESS_A);
    expect(bookingArg.where.status.notIn).toContain("rescheduled");
    expect(bookingArg.take).toBe(30);

    const clientArg = prisma.client.findMany.mock.calls[0][0] as {
      where: { businessId: string };
      take: number;
    };
    expect(clientArg.where.businessId).toBe(BUSINESS_A);
    expect(clientArg.take).toBe(50);
  });

  it("omits the price when the booking snapshot is zero", async () => {
    prisma.booking.findMany.mockResolvedValue([
      {
        id: "bkg_1",
        startTime: new Date("2026-07-01T09:30:00Z"),
        priceSnapshot: new Prisma.Decimal(0),
        client: { fullName: "דנה" },
        service: { name: "מניקור" },
      },
    ]);
    prisma.client.findMany.mockResolvedValue([]);
    const res = await getComposerData(tenant);
    expect(res.bookingOptions[0].price).toBeUndefined();
  });
});

describe("resolveTemplate", () => {
  it("prefers an active business override over the system default", async () => {
    prisma.messageTemplate.findUnique.mockResolvedValue({ body: "override", isActive: true });
    prisma.systemMessageTemplate.findUnique.mockResolvedValue({ body: "system", isActive: true });
    const res = await resolveTemplate(tenant, "booking_confirmation");
    expect(res).toBe("override");

    // business override looked up scoped by business + type
    expect(prisma.messageTemplate.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId_type: { businessId: BUSINESS_A, type: "booking_confirmation" } },
      }),
    );
  });

  it("falls back to the system default when the business override is inactive", async () => {
    prisma.messageTemplate.findUnique.mockResolvedValue({ body: "override", isActive: false });
    prisma.systemMessageTemplate.findUnique.mockResolvedValue({ body: "system", isActive: true });
    const res = await resolveTemplate(tenant, "booking_confirmation");
    expect(res).toBe("system");
  });

  it("falls back to the system default when there is no business override", async () => {
    prisma.messageTemplate.findUnique.mockResolvedValue(null);
    prisma.systemMessageTemplate.findUnique.mockResolvedValue({ body: "system", isActive: true });
    expect(await resolveTemplate(tenant, "booking_reminder")).toBe("system");
  });

  it("returns null when neither template is active", async () => {
    prisma.messageTemplate.findUnique.mockResolvedValue({ body: "override", isActive: false });
    prisma.systemMessageTemplate.findUnique.mockResolvedValue({ body: "system", isActive: false });
    expect(await resolveTemplate(tenant, "booking_reminder")).toBeNull();
  });

  it("returns null when no templates exist at all", async () => {
    prisma.messageTemplate.findUnique.mockResolvedValue(null);
    prisma.systemMessageTemplate.findUnique.mockResolvedValue(null);
    expect(await resolveTemplate(tenant, "after_treatment")).toBeNull();
  });
});
