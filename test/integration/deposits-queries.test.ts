import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
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

import { getBookingDepositPayment } from "@/server/deposits/queries";

const tenant = { businessId: BUSINESS_A };

beforeEach(() => resetPrismaMock(prisma));

describe("getBookingDepositPayment", () => {
  it("queries the deposit payment scoped by businessId + bookingId", async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: "pay_1",
      amount: new Prisma.Decimal(50),
      status: "paid",
      markedPaidAt: new Date("2026-06-01T00:00:00Z"),
      refundedAt: null,
    });

    const res = await getBookingDepositPayment(tenant, "bkg_1");
    expect(res).toMatchObject({ id: "pay_1", amount: 50, status: "paid" });

    expect(prisma.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bookingId: "bkg_1",
          businessId: BUSINESS_A,
          type: "deposit",
        }),
      }),
    );
  });

  it("returns null when no deposit payment exists for the booking", async () => {
    prisma.payment.findFirst.mockResolvedValue(null);
    await expect(getBookingDepositPayment(tenant, "bkg_x")).resolves.toBeNull();
  });
});
