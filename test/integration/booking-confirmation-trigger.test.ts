import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BUSINESS_A } from "../helpers/factories";

/**
 * Owner/internal WhatsApp booking confirmation trigger
 * (server/public-booking/send-confirmation.ts → sendBookingConfirmationById).
 *
 * This is the fix for "approved booking does not send WhatsApp confirmation":
 * the trigger now fires when an owner creates an already-approved booking or
 * approves a pending one. It must:
 *   - load the booking scoped by businessId (never by id alone, CLAUDE.md §10);
 *   - only send for approved bookings;
 *   - be idempotent (confirmationSentAt set → no-op, no duplicate send);
 *   - respect every downstream safety guard (phone, opt-out, template, provider);
 *   - never throw into the caller.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof import("../helpers/prisma-mock").createPrismaMock>;

const send = vi.fn();
const getWhatsAppProviderForBusiness = vi.fn(async () => ({ send }));
vi.mock("@/server/whatsapp/resolver", () => ({
  getWhatsAppProviderForBusiness: (...a: unknown[]) =>
    getWhatsAppProviderForBusiness(...(a as [])),
}));

import { resetPrismaMock } from "../helpers/prisma-mock";
import { sendBookingConfirmationById } from "@/server/public-booking/send-confirmation";

/** A fully-loaded, sendable booking row as returned by the scoped findFirst. */
function makeBookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "bkg_1",
    status: "approved",
    startTime: new Date("2026-07-01T09:00:00Z"),
    confirmationSentAt: null,
    client: { id: "cli_1", fullName: "דנה", phone: "050-123-4567" },
    service: { name: "מניקור" },
    business: { name: "סטודיו יופי" },
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock(prisma);
  send.mockReset().mockResolvedValue({ success: true, providerMessageId: "wamid.1" });
  getWhatsAppProviderForBusiness.mockClear();
  // Default: a sendable approved booking.
  prisma.booking.findFirst.mockResolvedValue(makeBookingRow());
  // Downstream _send stubs: client opted in, no template overrides, audit rows create.
  prisma.client.findUnique.mockResolvedValue({ unsubscribedAt: null, whatsappOptIn: true });
  prisma.automationSetting.findUnique.mockResolvedValue(null);
  prisma.messageTemplate.findUnique.mockResolvedValue(null);
  prisma.systemMessageTemplate.findUnique.mockResolvedValue(null);
  prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
  prisma.automationMessage.create.mockResolvedValue({ id: "msg_1" });
  prisma.automationMessage.update.mockResolvedValue({});
  prisma.automationRun.update.mockResolvedValue({});
  prisma.booking.update.mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("sendBookingConfirmationById — happy path", () => {
  it("loads the booking scoped by businessId and sends the confirmation", async () => {
    await sendBookingConfirmationById({ bookingId: "bkg_1", businessId: BUSINESS_A });

    // booking lookup is tenant-scoped, never by id alone
    const where = prisma.booking.findFirst.mock.calls[0]?.[0]?.where;
    expect(where).toEqual({ id: "bkg_1", businessId: BUSINESS_A });

    expect(getWhatsAppProviderForBusiness).toHaveBeenCalledWith(BUSINESS_A);
    expect(send).toHaveBeenCalledTimes(1);

    // audit row is tagged as an owner-initiated send
    const queued = prisma.automationMessage.create.mock.calls.at(-1)?.[0];
    expect(queued.data.source).toBe("manual_owner");
    expect(queued.data.businessId).toBe(BUSINESS_A);

    // booking is marked confirmed on success
    const bookingUpdate = prisma.booking.update.mock.calls.at(-1)?.[0];
    expect(bookingUpdate.where).toEqual({ id: "bkg_1" });
    expect(bookingUpdate.data).toHaveProperty("confirmationSentAt");
  });
});

describe("sendBookingConfirmationById — idempotency & state guards", () => {
  it("is a no-op when the booking was already confirmed (no duplicate send)", async () => {
    prisma.booking.findFirst.mockResolvedValue(
      makeBookingRow({ confirmationSentAt: new Date() }),
    );
    await sendBookingConfirmationById({ bookingId: "bkg_1", businessId: BUSINESS_A });
    expect(getWhatsAppProviderForBusiness).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(prisma.automationRun.create).not.toHaveBeenCalled();
  });

  it("is a no-op when the booking is not approved (e.g. still pending)", async () => {
    prisma.booking.findFirst.mockResolvedValue(makeBookingRow({ status: "pending" }));
    await sendBookingConfirmationById({ bookingId: "bkg_1", businessId: BUSINESS_A });
    expect(send).not.toHaveBeenCalled();
    expect(prisma.automationRun.create).not.toHaveBeenCalled();
  });

  it("is a no-op for a cross-tenant / missing booking (scoped findFirst returns null)", async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    await sendBookingConfirmationById({ bookingId: "bkg_x", businessId: BUSINESS_A });
    expect(send).not.toHaveBeenCalled();
    expect(prisma.automationRun.create).not.toHaveBeenCalled();
  });
});

describe("sendBookingConfirmationById — safety guards (skip with audit row)", () => {
  it("skips when the client has unsubscribed", async () => {
    prisma.client.findUnique.mockResolvedValue({
      unsubscribedAt: new Date(),
      whatsappOptIn: true,
    });
    await sendBookingConfirmationById({ bookingId: "bkg_1", businessId: BUSINESS_A });
    expect(send).not.toHaveBeenCalled();
    const msgArg = prisma.automationMessage.create.mock.calls.at(-1)?.[0];
    expect(msgArg.data.status).toBe("skipped");
    expect(msgArg.data.source).toBe("manual_owner");
  });

  it("skips (no provider call) when the client has no valid phone", async () => {
    prisma.booking.findFirst.mockResolvedValue(
      makeBookingRow({ client: { id: "cli_1", fullName: "דנה", phone: "not-a-phone" } }),
    );
    await sendBookingConfirmationById({ bookingId: "bkg_1", businessId: BUSINESS_A });
    expect(getWhatsAppProviderForBusiness).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    const msgArg = prisma.automationMessage.create.mock.calls.at(-1)?.[0];
    expect(msgArg.data.status).toBe("skipped");
  });

  it("skips with a 'template not set' reason when real-send is on but no approved template exists", async () => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    await sendBookingConfirmationById({ bookingId: "bkg_1", businessId: BUSINESS_A });
    expect(send).not.toHaveBeenCalled();
    const updates = prisma.automationMessage.update.mock.calls.map((c) => c[0]);
    expect(updates.some((u) => u.data.status === "skipped")).toBe(true);
  });
});

describe("sendBookingConfirmationById — failures stay safe", () => {
  it("records a failed message (and does not confirm) when the provider returns failure", async () => {
    send.mockResolvedValue({ success: false, failureReason: "rejected" });
    await sendBookingConfirmationById({ bookingId: "bkg_1", businessId: BUSINESS_A });
    const updates = prisma.automationMessage.update.mock.calls.map((c) => c[0]);
    expect(updates.some((u) => u.data.status === "failed")).toBe(true);
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it("never throws even when the provider throws (no secret leak into the caller)", async () => {
    send.mockRejectedValue(new Error("EAAsecretTokenLeak123"));
    await expect(
      sendBookingConfirmationById({ bookingId: "bkg_1", businessId: BUSINESS_A }),
    ).resolves.toBeUndefined();
  });
});
