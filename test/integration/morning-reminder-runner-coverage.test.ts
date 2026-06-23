import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

/**
 * Branch coverage for runMorningReminderForBusiness beyond the dev-mock suite:
 * business-not-found, the fixed-hour gate, the evening (thresholdDays=1) and
 * same-day window modes, the real-send template guard, and the provider
 * success/failure/throw result branches via a controllable resolver.
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

import { runMorningReminderForBusiness } from "@/server/morning-reminder/runner";

function bookingRow(overrides: Record<string, unknown> = {}, clientOverrides: Record<string, unknown> = {}) {
  return {
    id: "bkg_1",
    clientId: "cli_1",
    startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    client: {
      fullName: "דנה",
      normalizedPhone: "+972501234567",
      unsubscribedAt: null,
      whatsappOptIn: true,
      ...clientOverrides,
    },
    service: { name: "מניקור" },
    ...overrides,
  };
}

// sendHour=-2 (relative) bypasses the fixed-hour gate computation gracefully.
const BASE = { businessId: BUSINESS_A, sendHour: -2, thresholdDays: 0, bypassHourCheck: true };

beforeEach(() => {
  resetPrismaMock(prisma);
  send.mockReset();
  delete process.env.ENABLE_REAL_WHATSAPP_SEND;
  prisma.business.findUnique.mockResolvedValue({ name: "סטודיו יופי", timezone: "Asia/Jerusalem" });
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

describe("runMorningReminderForBusiness — gates & not-found", () => {
  it("returns success with nothing done when the fixed hour does not match (non-bypass)", async () => {
    // sendHour 5 will almost never equal the current Israel hour; pick an hour
    // that differs from "now" deterministically by reading it first.
    const israelHour = parseInt(
      new Intl.DateTimeFormat("he-IL", { hour: "numeric", hour12: false, timeZone: "Asia/Jerusalem" }).format(new Date()),
      10,
    );
    const wrongHour = (israelHour + 5) % 24;
    const res = await runMorningReminderForBusiness({
      businessId: BUSINESS_A,
      sendHour: wrongHour,
      thresholdDays: 0,
      bypassHourCheck: false,
    });
    expect(res.success).toBe(true);
    expect(res.sentCount).toBe(0);
    // Gate returns before loading the business.
    expect(prisma.business.findUnique).not.toHaveBeenCalled();
  });

  it("returns an error when the business is not found", async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    const res = await runMorningReminderForBusiness(BASE);
    expect(res.success).toBe(false);
    expect(res.error).toBe("Business not found");
  });
});

describe("runMorningReminderForBusiness — window modes", () => {
  it("evening-before mode (thresholdDays=1) targets tomorrow's bookings", async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    const now = new Date("2026-06-21T18:00:00Z");
    await runMorningReminderForBusiness({
      businessId: BUSINESS_A,
      sendHour: 20,
      thresholdDays: 1,
      bypassHourCheck: true,
      now,
    });
    const where = prisma.booking.findMany.mock.calls[0][0].where;
    // window start should be after "now" (tomorrow)
    expect(where.startTime.gte.getTime()).toBeGreaterThan(now.getTime());
  });

  it("same-day morning mode (thresholdDays>1) targets today's bookings", async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    const now = new Date("2026-06-21T07:00:00Z");
    await runMorningReminderForBusiness({
      businessId: BUSINESS_A,
      sendHour: 8,
      thresholdDays: 3,
      bypassHourCheck: true,
      now,
    });
    const where = prisma.booking.findMany.mock.calls[0][0].where;
    expect(where.status.in).toContain("approved");
    expect(where.reminderSentAt).toBeNull();
  });
});

describe("runMorningReminderForBusiness — provider result branches", () => {
  it("marks sent + stamps reminderSentAt on real provider success", async () => {
    prisma.booking.findMany.mockResolvedValue([bookingRow()]);
    send.mockResolvedValue({ success: true, providerMessageId: "wamid.R" });
    const res = await runMorningReminderForBusiness(BASE);
    expect(res.sentCount).toBe(1);
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reminderSentAt: expect.any(Date) } }),
    );
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "completed" }) }),
    );
  });

  it("records a failed message and a failed run when the provider fails for the only booking", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    prisma.booking.findMany.mockResolvedValue([bookingRow()]);
    send.mockResolvedValue({ success: false, failureReason: "no template" });
    const res = await runMorningReminderForBusiness(BASE);
    expect(res.failedCount).toBe(1);
    expect(res.sentCount).toBe(0);
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }),
    );
  });

  it("isolates a thrown send error (partial run when another booking succeeds)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    prisma.booking.findMany.mockResolvedValue([
      bookingRow({ id: "b1", clientId: "c1" }),
      bookingRow({ id: "b2", clientId: "c2" }),
    ]);
    send
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ success: true, providerMessageId: "ok2" });
    const res = await runMorningReminderForBusiness(BASE);
    expect(res.failedCount).toBe(1);
    expect(res.sentCount).toBe(1);
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "partial" }) }),
    );
  });

  it("passes 5 positional template variables (incl. business name) when a templateName is configured", async () => {
    prisma.booking.findMany.mockResolvedValue([bookingRow()]);
    send.mockResolvedValue({ success: true, providerMessageId: "x" });
    await runMorningReminderForBusiness({ ...BASE, templateName: "appointment_reminder_he" });
    const arg = send.mock.calls[0][0] as { templateId: string; templateVariables: Record<string, string> };
    expect(arg.templateId).toBe("appointment_reminder_he");
    // {{1}} client, {{2}} business (so the customer sees it is sent on behalf of
    // the business), {{3}} service, {{4}} date, {{5}} time.
    expect(arg.templateVariables["1"]).toBe("דנה");
    expect(arg.templateVariables["2"]).toBe("סטודיו יופי");
    expect(arg.templateVariables["3"]).toBe("מניקור");
    expect(typeof arg.templateVariables["4"]).toBe("string");
    expect(typeof arg.templateVariables["5"]).toBe("string");
  });

  it("prefers an explicit messageTemplate over the system default and custom template", async () => {
    prisma.booking.findMany.mockResolvedValue([bookingRow()]);
    send.mockResolvedValue({ success: true, providerMessageId: "x" });
    await runMorningReminderForBusiness({ ...BASE, messageTemplate: "תזכורת מותאמת {שם הלקוח}" });
    const created = prisma.automationMessage.create.mock.calls[0][0].data;
    expect(created.messageText).toBe("תזכורת מותאמת דנה");
    // The custom-template lookup is skipped entirely when messageTemplate is set.
    expect(prisma.messageTemplate.findUnique).not.toHaveBeenCalled();
  });

  it("uses an active custom booking_reminder template when no explicit template is given", async () => {
    prisma.booking.findMany.mockResolvedValue([bookingRow()]);
    prisma.messageTemplate.findUnique.mockResolvedValue({ isActive: true, body: "תזכורת {שם הלקוח}" });
    send.mockResolvedValue({ success: true, providerMessageId: "x" });
    await runMorningReminderForBusiness(BASE);
    const created = prisma.automationMessage.create.mock.calls[0][0].data;
    expect(created.messageText).toBe("תזכורת דנה");
  });
});

describe("runMorningReminderForBusiness — real-send template guard", () => {
  it("skips all bookings and errors when real send is on without a templateName", async () => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    prisma.booking.findMany.mockResolvedValue([
      bookingRow({ id: "b1", clientId: "c1" }),
      bookingRow({ id: "b2", clientId: "c2" }),
    ]);
    const res = await runMorningReminderForBusiness({ ...BASE, templateName: null });
    expect(res.success).toBe(false);
    expect(res.skippedCount).toBe(2);
    expect(send).not.toHaveBeenCalled();
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "completed", skippedCount: 2 }) }),
    );
  });
});
