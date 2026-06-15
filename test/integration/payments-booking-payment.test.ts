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
  createBookingPayment,
  applyPaymentWebhookEvent,
} from "@/server/payments/booking-payment";
import type { ParsedWebhookEvent } from "@/lib/payments/provider";

beforeEach(() => {
  resetPrismaMock(prisma);
});

describe("createBookingPayment (mock provider, no real money)", () => {
  it("creates a hosted payment link and stores NO card data", async () => {
    prisma.businessPaymentSettings.findUnique.mockResolvedValue({ provider: "mock" });
    prisma.bookingPayment.findUnique.mockResolvedValue(null);
    prisma.bookingPayment.create.mockResolvedValue({ id: "bp_1" });
    prisma.bookingPayment.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "bp_1",
      paymentUrl: "http://localhost:3000/pay/mock/bp_1?txn=mock_x",
      status: "payment_link_created",
      ...data,
    }));

    const res = await createBookingPayment({
      businessId: BUSINESS_A,
      bookingId: "bkg_1",
      clientId: "cli_1",
      amountMinor: 5000,
      customerName: "דנה",
      customerPhone: "0501234567",
      description: "מניקור · סטודיו",
    });

    expect(res.ok).toBe(true);
    expect(res.paymentUrl).toContain("/pay/mock/bp_1");

    // The created record must never contain card/PAN fields.
    const createData = prisma.bookingPayment.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(createData.businessId).toBe(BUSINESS_A);
    expect(createData.amountMinor).toBe(5000);
    expect(createData.currency).toBe("ILS");
    const keys = Object.keys(createData).join(",").toLowerCase();
    expect(keys).not.toContain("card");
    expect(keys).not.toContain("cvv");
    expect(keys).not.toContain("pan");
  });

  it("refuses to create a link for a non-positive amount", async () => {
    const res = await createBookingPayment({
      businessId: BUSINESS_A,
      bookingId: "bkg_1",
      clientId: "cli_1",
      amountMinor: 0,
      customerName: "דנה",
      customerPhone: "0501234567",
      description: "x",
    });
    expect(res.ok).toBe(false);
    expect(res.paymentUrl).toBeNull();
    expect(prisma.bookingPayment.create).not.toHaveBeenCalled();
  });
});

describe("applyPaymentWebhookEvent", () => {
  const paidEvent: ParsedWebhookEvent = {
    providerTransactionId: "mock_x",
    status: "paid",
    paidAt: new Date("2026-06-15T10:00:00Z"),
    raw: { mock: true },
  };

  it("marks the BookingPayment paid and never touches the booking (stays pending)", async () => {
    prisma.bookingPayment.findUnique.mockResolvedValue({
      id: "bp_1",
      status: "payment_link_created",
      bookingId: "bkg_1",
    });

    const res = await applyPaymentWebhookEvent(paidEvent);
    expect(res.applied).toBe(true);

    expect(prisma.bookingPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bp_1" },
        data: expect.objectContaining({ status: "paid" }),
      }),
    );
    // The booking record is never mutated — payment state lives on BookingPayment.
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it("is idempotent — a repeated event on a terminal payment is a no-op", async () => {
    prisma.bookingPayment.findUnique.mockResolvedValue({
      id: "bp_1",
      status: "paid",
      bookingId: "bkg_1",
    });
    const res = await applyPaymentWebhookEvent(paidEvent);
    expect(res.applied).toBe(false);
    expect(res.reason).toBe("already_terminal");
    expect(prisma.bookingPayment.update).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it("marks a failed event safely", async () => {
    prisma.bookingPayment.findUnique.mockResolvedValue({
      id: "bp_1",
      status: "payment_link_created",
      bookingId: "bkg_1",
    });
    const res = await applyPaymentWebhookEvent({
      providerTransactionId: "mock_x",
      status: "failed",
      raw: {},
    });
    expect(res.applied).toBe(true);
    expect(prisma.bookingPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }),
    );
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it("ignores an unknown transaction id", async () => {
    prisma.bookingPayment.findUnique.mockResolvedValue(null);
    const res = await applyPaymentWebhookEvent(paidEvent);
    expect(res.applied).toBe(false);
    expect(res.reason).toBe("unknown_transaction");
  });
});
