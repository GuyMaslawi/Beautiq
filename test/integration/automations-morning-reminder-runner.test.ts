import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>).__prismaMock as ReturnType<
  typeof createPrismaMock
>;

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

const BASE = {
  businessId: BUSINESS_A,
  sendHour: -2, // relative mode: bookings ~2h ahead; bypasses fixed-hour gate
  thresholdDays: 0,
  bypassHourCheck: true,
};

let fetchSpy: ReturnType<typeof vi.fn> | undefined;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetPrismaMock(prisma);
  fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
  prisma.business.findUnique.mockResolvedValue({ name: "סטודיו יופי", timezone: "Asia/Jerusalem" });
  prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
  prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
  prisma.automationRun.update.mockResolvedValue({ id: "run_1" });
  prisma.automationRun.findFirst.mockResolvedValue(null);
  prisma.messageTemplate.findUnique.mockResolvedValue(null);
  prisma.automationMessage.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: "m1", ...a.data }));
  prisma.automationMessage.update.mockResolvedValue({ id: "m1" });
  prisma.booking.update.mockResolvedValue({ id: "bkg_1" });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("runMorningReminderForBusiness — no real send (dev mock counts as sent)", () => {
  it("returns early when no bookings are due", async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    const result = await runMorningReminderForBusiness(BASE);
    expect(result.success).toBe(true);
    expect(result.sentCount).toBe(0);
    expect(prisma.automationMessage.create).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("creates run + message, builds Hebrew text, marks reminderSentAt, never fetches", async () => {
    prisma.booking.findMany.mockResolvedValue([bookingRow()]);
    const result = await runMorningReminderForBusiness(BASE);

    expect(result.success).toBe(true);
    // dev mock returns isMockSkip which the reminder runner treats as "sent"
    expect(result.sentCount).toBe(1);
    expect(prisma.automationRun.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "morning_reminder", status: "running" }) }),
    );
    const created = prisma.automationMessage.create.mock.calls[0][0].data;
    expect(created.messageText).toContain("דנה");
    expect(created.messageText).toContain("מניקור");
    expect(created.messageText).toContain("סטודיו יופי");
    expect(created.source).toBe("manual_admin");
    // booking marked as reminded via the $transaction
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reminderSentAt: expect.any(Date) } }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips an unsubscribed client without any provider/network call", async () => {
    prisma.booking.findMany.mockResolvedValue([
      bookingRow({}, { unsubscribedAt: new Date() }),
    ]);
    const result = await runMorningReminderForBusiness(BASE);
    expect(result.skippedCount).toBe(1);
    expect(result.sentCount).toBe(0);
    expect(prisma.automationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "skipped" }) }),
    );
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips a client without whatsappOptIn when requireOptIn=true", async () => {
    prisma.booking.findMany.mockResolvedValue([
      bookingRow({}, { whatsappOptIn: false }),
    ]);
    const result = await runMorningReminderForBusiness({ ...BASE, requireOptIn: true });
    expect(result.skippedCount).toBe(1);
    expect(result.sentCount).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips an invalid phone", async () => {
    prisma.booking.findMany.mockResolvedValue([
      bookingRow({}, { normalizedPhone: "+9725" }),
    ]);
    const result = await runMorningReminderForBusiness(BASE);
    expect(result.skippedCount).toBe(1);
    expect(result.sentCount).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("honours the idempotency guard (existing recent run, non-bypass)", async () => {
    prisma.automationRun.findFirst.mockResolvedValue({ id: "existing_run" });
    const result = await runMorningReminderForBusiness({
      businessId: BUSINESS_A,
      sendHour: -2,
      thresholdDays: 0,
      bypassHourCheck: false,
    });
    expect(result.alreadyRan).toBe(true);
    expect(result.runId).toBe("existing_run");
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });
});
