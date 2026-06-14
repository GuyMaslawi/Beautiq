import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";
import { DEPOSITS } from "@/lib/constants/he";

/**
 * Deposit status action. Asserts the booking is loaded scoped by businessId
 * (cross-tenant id → not found), that the status-transition guard is enforced,
 * and that "not_required" deposits cannot be changed.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireTenant = vi.fn(async () => ({ businessId: BUSINESS_A }));
vi.mock("@/server/auth/session", () => ({
  requireTenant: (...args: unknown[]) => (requireTenant as (...a: unknown[]) => unknown)(...args),
}));

import { updateDepositStatusAction } from "@/server/deposits/actions";

beforeEach(() => {
  resetPrismaMock(prisma);
  requireTenant.mockReset().mockResolvedValue({ businessId: BUSINESS_A });
});

describe("updateDepositStatusAction", () => {
  it("loads the booking scoped by businessId (cross-tenant id finds nothing)", async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    const res = await updateDepositStatusAction("bkg_other_biz", "paid");
    expect(res.error).toBe(DEPOSITS.errors.notFound);
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bkg_other_biz", businessId: BUSINESS_A },
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses to change a 'not_required' deposit", async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: "bkg_1",
      clientId: "cli_1",
      depositStatus: "not_required",
      depositAmountSnapshot: null,
    });
    const res = await updateDepositStatusAction("bkg_1", "paid");
    expect(res.error).toBe(DEPOSITS.errors.notAllowed);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an invalid status transition (e.g. pending → refunded)", async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: "bkg_1",
      clientId: "cli_1",
      depositStatus: "pending",
      depositAmountSnapshot: new Prisma.Decimal(50),
    });
    const res = await updateDepositStatusAction("bkg_1", "refunded");
    expect(res.error).toBe(DEPOSITS.errors.invalidTransition);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("marks pending → paid, scoping the Payment lookup/create by businessId", async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: "bkg_1",
      clientId: "cli_1",
      depositStatus: "pending",
      depositAmountSnapshot: new Prisma.Decimal(50),
    });
    prisma.booking.update.mockResolvedValue({});
    prisma.payment.findFirst.mockResolvedValue(null); // no existing payment
    prisma.payment.create.mockResolvedValue({ id: "pay_1" });

    const res = await updateDepositStatusAction("bkg_1", "paid");
    expect(res.success).toBe(true);

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bkg_1" },
        data: { depositStatus: "paid" },
      }),
    );
    // Payment lookup scoped by businessId.
    expect(prisma.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bookingId: "bkg_1", businessId: BUSINESS_A }),
      }),
    );
    const createArg = prisma.payment.create.mock.calls[0][0] as {
      data: { businessId: string; status: string; amount: unknown };
    };
    expect(createArg.data.businessId).toBe(BUSINESS_A);
    expect(createArg.data.status).toBe("paid");
  });

  it("updates the existing Payment row instead of creating a duplicate", async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: "bkg_1",
      clientId: "cli_1",
      depositStatus: "pending",
      depositAmountSnapshot: new Prisma.Decimal(50),
    });
    prisma.booking.update.mockResolvedValue({});
    prisma.payment.findFirst.mockResolvedValue({ id: "pay_existing" });
    prisma.payment.update.mockResolvedValue({});

    const res = await updateDepositStatusAction("bkg_1", "paid");
    expect(res.success).toBe(true);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pay_existing" } }),
    );
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("allows paid → refunded", async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: "bkg_1",
      clientId: "cli_1",
      depositStatus: "paid",
      depositAmountSnapshot: new Prisma.Decimal(50),
    });
    prisma.booking.update.mockResolvedValue({});
    prisma.payment.findFirst.mockResolvedValue({ id: "pay_1" });
    prisma.payment.update.mockResolvedValue({});

    const res = await updateDepositStatusAction("bkg_1", "refunded");
    expect(res.success).toBe(true);
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { depositStatus: "refunded" } }),
    );
  });

  it("returns a safe generic error when the transaction throws", async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: "bkg_1",
      clientId: "cli_1",
      depositStatus: "pending",
      depositAmountSnapshot: new Prisma.Decimal(50),
    });
    prisma.$transaction.mockRejectedValueOnce(new Error("secret db error"));
    const res = await updateDepositStatusAction("bkg_1", "paid");
    expect(res.error).toBe(DEPOSITS.errors.generic);
    expect(res.error).not.toContain("secret");
  });
});
