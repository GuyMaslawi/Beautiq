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

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireTenant = vi.fn(async () => ({ businessId: BUSINESS_A }));
vi.mock("@/server/auth/session", () => ({
  requireTenant: (...a: unknown[]) =>
    (requireTenant as (...x: unknown[]) => unknown)(...a),
}));

import {
  saveReminderSettingsAction,
  markReminderSentAction,
  markReminderPendingAction,
} from "@/server/automations/actions";

beforeEach(() => {
  resetPrismaMock(prisma);
  requireTenant.mockReset().mockResolvedValue({ businessId: BUSINESS_A });
});

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("saveReminderSettingsAction", () => {
  const valid = { reminderHoursBefore: "24", reminderTemplate: "היי {שם}" };

  it("merges into existing settings JSON scoped by tenant and returns success", async () => {
    prisma.business.findUnique.mockResolvedValue({
      settings: { existing: "keep" },
    });
    prisma.business.update.mockResolvedValue({});
    const res = await saveReminderSettingsAction({}, fd(valid));
    expect(res.success).toBeTruthy();
    expect(prisma.business.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BUSINESS_A } }),
    );
    expect(prisma.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BUSINESS_A },
        data: {
          settings: {
            existing: "keep",
            reminderHoursBefore: 24,
            reminderTemplate: "היי {שם}",
          },
        },
      }),
    );
  });

  it("handles missing existing settings (defaults to empty object)", async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    prisma.business.update.mockResolvedValue({});
    const res = await saveReminderSettingsAction({}, fd(valid));
    expect(res.success).toBeTruthy();
    const arg = prisma.business.update.mock.calls[0][0] as {
      data: { settings: Record<string, unknown> };
    };
    expect(arg.data.settings.reminderHoursBefore).toBe(24);
  });

  it("rejects non-numeric hours without writing", async () => {
    const res = await saveReminderSettingsAction({}, fd({ ...valid, reminderHoursBefore: "abc" }));
    expect(res.error).toBeTruthy();
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it("rejects hours out of the 1-168 range", async () => {
    const low = await saveReminderSettingsAction({}, fd({ ...valid, reminderHoursBefore: "0" }));
    const high = await saveReminderSettingsAction({}, fd({ ...valid, reminderHoursBefore: "200" }));
    expect(low.error).toBeTruthy();
    expect(high.error).toBeTruthy();
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it("rejects an empty template without writing", async () => {
    const res = await saveReminderSettingsAction({}, fd({ ...valid, reminderTemplate: "" }));
    expect(res.error).toBeTruthy();
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it("returns a safe error (no secret) when the DB throws", async () => {
    prisma.business.findUnique.mockRejectedValue(new Error("secret db string"));
    const res = await saveReminderSettingsAction({}, fd(valid));
    expect(res.error).toBeTruthy();
    expect(res.error).not.toContain("secret");
  });
});

describe("markReminderSentAction", () => {
  it("returns an error when the booking does not belong to the tenant", async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    const res = await markReminderSentAction("bkg_other");
    expect(res.error).toBeTruthy();
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bkg_other", businessId: BUSINESS_A },
      }),
    );
    expect(prisma.reminder.create).not.toHaveBeenCalled();
    expect(prisma.reminder.update).not.toHaveBeenCalled();
  });

  it("updates an existing reminder to sent", async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: "bkg_1",
      startTime: new Date("2026-07-01T09:00:00Z"),
    });
    prisma.reminder.findFirst.mockResolvedValue({ id: "rem_1" });
    prisma.reminder.update.mockResolvedValue({});
    const res = await markReminderSentAction("bkg_1");
    expect(res.success).toBeTruthy();
    expect(prisma.reminder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: "bkg_1", businessId: BUSINESS_A, type: "booking_reminder" },
      }),
    );
    expect(prisma.reminder.update).toHaveBeenCalledWith({
      where: { id: "rem_1" },
      data: { status: "sent" },
    });
    expect(prisma.reminder.create).not.toHaveBeenCalled();
  });

  it("creates a new sent reminder scoped to the tenant when none exists", async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: "bkg_1",
      startTime: new Date("2026-07-01T09:00:00Z"),
    });
    prisma.reminder.findFirst.mockResolvedValue(null);
    prisma.reminder.create.mockResolvedValue({});
    const res = await markReminderSentAction("bkg_1");
    expect(res.success).toBeTruthy();
    expect(prisma.reminder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: BUSINESS_A,
          bookingId: "bkg_1",
          type: "booking_reminder",
          status: "sent",
        }),
      }),
    );
  });

  it("returns a safe error when the reminder write throws", async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: "bkg_1",
      startTime: new Date("2026-07-01T09:00:00Z"),
    });
    prisma.reminder.findFirst.mockRejectedValue(new Error("secret boom"));
    const res = await markReminderSentAction("bkg_1");
    expect(res.error).toBeTruthy();
    expect(res.error).not.toContain("secret");
  });
});

describe("markReminderPendingAction", () => {
  it("returns an error when the reminder is not in the tenant", async () => {
    prisma.reminder.findFirst.mockResolvedValue(null);
    const res = await markReminderPendingAction("rem_other");
    expect(res.error).toBeTruthy();
    expect(prisma.reminder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rem_other", businessId: BUSINESS_A },
      }),
    );
    expect(prisma.reminder.update).not.toHaveBeenCalled();
  });

  it("resets a reminder back to pending", async () => {
    prisma.reminder.findFirst.mockResolvedValue({ id: "rem_1" });
    prisma.reminder.update.mockResolvedValue({});
    const res = await markReminderPendingAction("rem_1");
    expect(res.success).toBeTruthy();
    expect(prisma.reminder.update).toHaveBeenCalledWith({
      where: { id: "rem_1" },
      data: { status: "pending" },
    });
  });

  it("returns a safe error when the update throws", async () => {
    prisma.reminder.findFirst.mockResolvedValue({ id: "rem_1" });
    prisma.reminder.update.mockRejectedValue(new Error("secret boom"));
    const res = await markReminderPendingAction("rem_1");
    expect(res.error).toBeTruthy();
    expect(res.error).not.toContain("secret");
  });
});
