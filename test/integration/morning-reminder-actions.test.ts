import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, BUSINESS_B } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const requireTenant = vi.fn(async () => ({ businessId: BUSINESS_A }));
vi.mock("@/server/auth/session", () => ({
  requireTenant: (...args: unknown[]) =>
    (requireTenant as (...a: unknown[]) => unknown)(...args),
}));

import {
  toggleMorningReminderAction,
  saveMorningReminderSettingsAction,
  saveMorningReminderTimingAction,
} from "@/server/morning-reminder/actions";

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  resetPrismaMock(prisma);
  revalidatePath.mockReset();
  requireTenant.mockReset().mockResolvedValue({ businessId: BUSINESS_A });
});

describe("toggleMorningReminderAction", () => {
  it("upserts scoped to the authenticated business and revalidates", async () => {
    prisma.automationSetting.upsert.mockResolvedValue({ id: "as_1" });
    const res = await toggleMorningReminderAction(true);
    expect(res.success).toBe(true);
    expect(prisma.automationSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId_type: { businessId: BUSINESS_A, type: "morning_reminder" },
        },
        create: expect.objectContaining({
          businessId: BUSINESS_A,
          type: "morning_reminder",
          enabled: true,
        }),
        update: { enabled: true },
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/automations");
  });

  it("returns a safe error (no revalidate) when the DB write throws", async () => {
    prisma.automationSetting.upsert.mockRejectedValue(new Error("secret db"));
    const res = await toggleMorningReminderAction(false);
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
    expect(res.error).not.toContain("secret");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("saveMorningReminderSettingsAction", () => {
  it("rejects an out-of-range sendHour without writing", async () => {
    const res = await saveMorningReminderSettingsAction({}, fd({ sendHour: "20" }));
    expect(res.error).toBeTruthy();
    expect(prisma.automationSetting.upsert).not.toHaveBeenCalled();
  });

  it("rejects a sendHour below the minimum", async () => {
    const res = await saveMorningReminderSettingsAction({}, fd({ sendHour: "3" }));
    expect(res.error).toBeTruthy();
    expect(prisma.automationSetting.upsert).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric sendHour", async () => {
    const res = await saveMorningReminderSettingsAction({}, fd({ sendHour: "abc" }));
    expect(res.error).toBeTruthy();
    expect(prisma.automationSetting.upsert).not.toHaveBeenCalled();
  });

  it("saves valid settings scoped to the business and normalizes empty template to null", async () => {
    prisma.automationSetting.upsert.mockResolvedValue({ id: "as_1" });
    const res = await saveMorningReminderSettingsAction(
      {},
      fd({ sendHour: "9", messageTemplate: "  " }),
    );
    expect(res.success).toBeTruthy();
    expect(prisma.automationSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { sendHour: 9, messageTemplate: null },
        create: expect.objectContaining({
          businessId: BUSINESS_A,
          sendHour: 9,
          messageTemplate: null,
        }),
      }),
    );
  });

  it("trims and keeps a real template body", async () => {
    prisma.automationSetting.upsert.mockResolvedValue({ id: "as_1" });
    await saveMorningReminderSettingsAction(
      {},
      fd({ sendHour: "8", messageTemplate: "  בוקר טוב  " }),
    );
    const arg = prisma.automationSetting.upsert.mock.calls[0][0] as {
      update: { messageTemplate: string | null };
    };
    expect(arg.update.messageTemplate).toBe("בוקר טוב");
  });

  it("defaults sendHour to 8 when not provided", async () => {
    prisma.automationSetting.upsert.mockResolvedValue({ id: "as_1" });
    await saveMorningReminderSettingsAction({}, fd({}));
    const arg = prisma.automationSetting.upsert.mock.calls[0][0] as {
      update: { sendHour: number };
    };
    expect(arg.update.sendHour).toBe(8);
  });

  it("returns a safe error when the upsert throws", async () => {
    prisma.automationSetting.upsert.mockRejectedValue(new Error("secret db"));
    const res = await saveMorningReminderSettingsAction({}, fd({ sendHour: "8" }));
    expect(res.error).toBeTruthy();
    expect(res.error).not.toContain("secret");
  });
});

describe("saveMorningReminderTimingAction", () => {
  it("persists timing scoped to the business with defaults applied", async () => {
    prisma.automationSetting.upsert.mockResolvedValue({ id: "as_1" });
    const res = await saveMorningReminderTimingAction({
      sendHour: 9,
      thresholdDays: 2,
      messageTemplate: "txt",
    });
    expect(res.success).toBeTruthy();
    expect(prisma.automationSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId_type: { businessId: BUSINESS_A, type: "morning_reminder" },
        },
        update: {
          sendHour: 9,
          thresholdDays: 2,
          messageTemplate: "txt",
          requireOptIn: false,
          templateName: null,
          templateLanguage: null,
        },
      }),
    );
  });

  it("passes through explicit optional fields", async () => {
    prisma.automationSetting.upsert.mockResolvedValue({ id: "as_1" });
    await saveMorningReminderTimingAction({
      sendHour: 7,
      thresholdDays: 1,
      messageTemplate: null,
      requireOptIn: true,
      templateName: "tpl",
      templateLanguage: "he",
    });
    const arg = prisma.automationSetting.upsert.mock.calls[0][0] as {
      update: Record<string, unknown>;
    };
    expect(arg.update).toMatchObject({
      requireOptIn: true,
      templateName: "tpl",
      templateLanguage: "he",
    });
  });

  it("ignores any injected businessId — always uses the tenant", async () => {
    requireTenant.mockResolvedValue({ businessId: BUSINESS_A });
    prisma.automationSetting.upsert.mockResolvedValue({ id: "as_1" });
    await saveMorningReminderTimingAction({
      sendHour: 8,
      thresholdDays: 0,
      messageTemplate: null,
    });
    const arg = prisma.automationSetting.upsert.mock.calls[0][0] as {
      create: { businessId: string };
    };
    expect(arg.create.businessId).toBe(BUSINESS_A);
    expect(arg.create.businessId).not.toBe(BUSINESS_B);
  });

  it("returns a safe error when the upsert throws", async () => {
    prisma.automationSetting.upsert.mockRejectedValue(new Error("secret db"));
    const res = await saveMorningReminderTimingAction({
      sendHour: 8,
      thresholdDays: 0,
      messageTemplate: null,
    });
    expect(res.error).toBeTruthy();
    expect(res.error).not.toContain("secret");
  });
});
