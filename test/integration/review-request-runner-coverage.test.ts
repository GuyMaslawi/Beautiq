import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

/**
 * Branch coverage for runReviewRequestForBusiness beyond the dev-mock happy
 * path the main suite covers. Here the resolver returns a controllable provider
 * so we can drive: a real provider success (status sent + booking marked), a
 * provider failure (status failed + warn), a thrown send error (catch path),
 * the requireOptIn skip, the real-send missing-template skip-all path, the
 * setting/custom template body resolution, and the cron (non-bypass) window.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>).__prismaMock as ReturnType<
  typeof createPrismaMock
>;

const send = vi.fn();
vi.mock("@/server/whatsapp/resolver", () => ({
  getWhatsAppProviderForBusiness: vi.fn(async () => ({ name: "stub", send })),
}));

import { runReviewRequestForBusiness } from "@/server/review-request/runner";

function completedBookingRow(
  bookingOverrides: Record<string, unknown> = {},
  clientOverrides: Record<string, unknown> = {},
) {
  return {
    id: "bkg_1",
    clientId: "cli_1",
    completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    client: {
      fullName: "דנה",
      normalizedPhone: "+972501234567",
      unsubscribedAt: null,
      whatsappOptIn: true,
      ...clientOverrides,
    },
    service: { name: "מניקור" },
    ...bookingOverrides,
  };
}

const BASE = { businessId: BUSINESS_A, sendHour: 24, bypassTiming: true };

beforeEach(() => {
  resetPrismaMock(prisma);
  send.mockReset();
  delete process.env.ENABLE_REAL_WHATSAPP_SEND;
  prisma.business.findUnique.mockResolvedValue({ name: "סטודיו יופי", slug: "studio-yofi" });
  prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
  prisma.automationRun.update.mockResolvedValue({ id: "run_1" });
  prisma.automationRun.findFirst.mockResolvedValue(null);
  prisma.messageTemplate.findUnique.mockResolvedValue(null);
  prisma.automationMessage.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: "m1", ...a.data }));
  prisma.automationMessage.update.mockResolvedValue({ id: "m1" });
  prisma.booking.update.mockResolvedValue({ id: "bkg_1" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runReviewRequestForBusiness — provider result branches", () => {
  it("returns error when the business is not found", async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    const res = await runReviewRequestForBusiness(BASE);
    expect(res.success).toBe(false);
    expect(res.error).toBe("Business not found");
  });

  it("marks the message sent and stamps reviewRequestSentAt on a real provider success", async () => {
    prisma.booking.findMany.mockResolvedValue([completedBookingRow()]);
    send.mockResolvedValue({ success: true, providerMessageId: "wamid.OK" });
    const res = await runReviewRequestForBusiness(BASE);
    expect(res.sentCount).toBe(1);
    expect(res.failedCount).toBe(0);
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "sent", providerMessageId: "wamid.OK" }) }),
    );
    expect(prisma.booking.update).toHaveBeenCalled();
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "completed" }) }),
    );
  });

  it("records a failed message (status failed) when the provider returns success:false", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    prisma.booking.findMany.mockResolvedValue([completedBookingRow()]);
    send.mockResolvedValue({ success: false, failureReason: "rejected by meta" });
    const res = await runReviewRequestForBusiness(BASE);
    expect(res.failedCount).toBe(1);
    expect(res.sentCount).toBe(0);
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed", failureReason: "rejected by meta" }) }),
    );
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }),
    );
    warn.mockRestore();
  });

  it("uses the default Hebrew failure reason when the provider gives none", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    prisma.booking.findMany.mockResolvedValue([completedBookingRow()]);
    send.mockResolvedValue({ success: false });
    await runReviewRequestForBusiness(BASE);
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ failureReason: "שגיאה לא ידועה" }) }),
    );
  });

  it("isolates a thrown send error into a failed message without aborting the run", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    prisma.booking.findMany.mockResolvedValue([
      completedBookingRow({ id: "b1", clientId: "c1" }),
      completedBookingRow({ id: "b2", clientId: "c2" }),
    ]);
    send
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ success: true, providerMessageId: "wamid.2" });
    const res = await runReviewRequestForBusiness(BASE);
    // one failed (thrown) + one sent → partial
    expect(res.failedCount).toBe(1);
    expect(res.sentCount).toBe(1);
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "partial" }) }),
    );
    err.mockRestore();
  });

  it("skips a client missing whatsappOptIn when requireOptIn=true", async () => {
    prisma.booking.findMany.mockResolvedValue([
      completedBookingRow({}, { whatsappOptIn: false }),
    ]);
    const res = await runReviewRequestForBusiness({ ...BASE, requireOptIn: true });
    expect(res.skippedCount).toBe(1);
    expect(res.sentCount).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(prisma.automationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ failureReason: "הלקוחה לא אישרה קבלת הודעות WhatsApp" }) }),
    );
  });

  it("skips an invalid phone before any provider call", async () => {
    prisma.booking.findMany.mockResolvedValue([
      completedBookingRow({}, { normalizedPhone: "+9725" }),
    ]);
    const res = await runReviewRequestForBusiness(BASE);
    expect(res.skippedCount).toBe(1);
    expect(send).not.toHaveBeenCalled();
  });

  it("prefers an explicit messageTemplate over the system default", async () => {
    prisma.booking.findMany.mockResolvedValue([completedBookingRow()]);
    send.mockResolvedValue({ success: true, providerMessageId: "x" });
    await runReviewRequestForBusiness({ ...BASE, messageTemplate: "תודה {שם הלקוח}!" });
    const created = prisma.automationMessage.create.mock.calls[0][0].data;
    expect(created.messageText).toBe("תודה דנה!");
  });

  it("uses an active custom after_treatment template when no explicit template is given", async () => {
    prisma.booking.findMany.mockResolvedValue([completedBookingRow()]);
    prisma.messageTemplate.findUnique.mockResolvedValue({ isActive: true, body: "ביקורת? {שם הלקוח}" });
    send.mockResolvedValue({ success: true, providerMessageId: "x" });
    await runReviewRequestForBusiness(BASE);
    const created = prisma.automationMessage.create.mock.calls[0][0].data;
    expect(created.messageText).toBe("ביקורת? דנה");
  });

  it("passes positional template variables (client, business, review link) when a templateName is configured", async () => {
    prisma.booking.findMany.mockResolvedValue([completedBookingRow()]);
    send.mockResolvedValue({ success: true, providerMessageId: "x" });
    await runReviewRequestForBusiness({ ...BASE, templateName: "review_he", templateLanguage: "he" });
    const arg = send.mock.calls[0][0] as { templateId: string; templateVariables: Record<string, string> };
    expect(arg.templateId).toBe("review_he");
    // {{1}} client, {{2}} business (sent on behalf of the business), {{3}} review link.
    expect(arg.templateVariables["1"]).toBe("דנה");
    expect(arg.templateVariables["2"]).toBe("סטודיו יופי");
    expect(typeof arg.templateVariables["3"]).toBe("string");
  });
});

describe("runReviewRequestForBusiness — real-send template guard", () => {
  it("skips every booking and returns an error when real send is on but templateName is missing", async () => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    prisma.booking.findMany.mockResolvedValue([
      completedBookingRow({ id: "b1", clientId: "c1" }),
      completedBookingRow({ id: "b2", clientId: "c2" }),
    ]);
    const res = await runReviewRequestForBusiness({ ...BASE, templateName: null });
    expect(res.success).toBe(false);
    expect(res.skippedCount).toBe(2);
    expect(res.error).toContain("תבנית WhatsApp");
    expect(send).not.toHaveBeenCalled();
    expect(prisma.automationMessage.create).toHaveBeenCalledTimes(2);
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "completed", skippedCount: 2 }) }),
    );
  });
});

describe("runReviewRequestForBusiness — cron timing window", () => {
  it("computes a narrow ±window on the cron path (no bypass) and queries completed bookings", async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    const now = new Date("2026-06-21T12:00:00Z");
    const res = await runReviewRequestForBusiness({
      businessId: BUSINESS_A,
      sendHour: 24,
      bypassTiming: false,
      now,
    });
    expect(res.success).toBe(true);
    const where = prisma.booking.findMany.mock.calls[0][0].where;
    expect(where.completedAt.gte).toBeInstanceOf(Date);
    expect(where.completedAt.lte).toBeInstanceOf(Date);
    // 24h ±4h window → start is ~28h ago, end ~20h ago
    expect(where.completedAt.lte.getTime()).toBeLessThan(now.getTime());
  });
});
