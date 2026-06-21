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

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const requireTenant = vi.fn(async () => ({ businessId: BUSINESS_A }));
vi.mock("@/server/auth/session", () => ({
  requireTenant: (...args: unknown[]) =>
    (requireTenant as (...a: unknown[]) => unknown)(...args),
}));

import {
  toggleReviewRequestAction,
  saveReviewRequestSettingsAction,
  saveReviewRequestTimingAction,
} from "@/server/review-request/actions";

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

describe("toggleReviewRequestAction", () => {
  it("upserts the review_request setting scoped to the business", async () => {
    prisma.automationSetting.upsert.mockResolvedValue({ id: "as_1" });
    const res = await toggleReviewRequestAction(true);
    expect(res.success).toBe(true);
    expect(prisma.automationSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId_type: { businessId: BUSINESS_A, type: "review_request" },
        },
        create: expect.objectContaining({
          businessId: BUSINESS_A,
          type: "review_request",
          enabled: true,
          sendHour: 10,
        }),
        update: { enabled: true },
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/automations");
  });

  it("returns a safe error when the write throws", async () => {
    prisma.automationSetting.upsert.mockRejectedValue(new Error("secret db"));
    const res = await toggleReviewRequestAction(false);
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
    expect(res.error).not.toContain("secret");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("saveReviewRequestSettingsAction", () => {
  it("normalizes blank template + reviewLink to null and saves scoped", async () => {
    prisma.automationSetting.upsert.mockResolvedValue({ id: "as_1" });
    const res = await saveReviewRequestSettingsAction(
      {},
      fd({ messageTemplate: "  ", reviewLink: "  " }),
    );
    expect(res.success).toBeTruthy();
    expect(prisma.automationSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { messageTemplate: null, offerValue: null },
        create: expect.objectContaining({ businessId: BUSINESS_A, type: "review_request" }),
      }),
    );
  });

  it("keeps trimmed template + link values", async () => {
    prisma.automationSetting.upsert.mockResolvedValue({ id: "as_1" });
    await saveReviewRequestSettingsAction(
      {},
      fd({ messageTemplate: " תודה ", reviewLink: " https://g.page/x " }),
    );
    const arg = prisma.automationSetting.upsert.mock.calls[0][0] as {
      update: { messageTemplate: string | null; offerValue: string | null };
    };
    expect(arg.update.messageTemplate).toBe("תודה");
    expect(arg.update.offerValue).toBe("https://g.page/x");
  });

  it("returns a safe error when the write throws", async () => {
    prisma.automationSetting.upsert.mockRejectedValue(new Error("secret db"));
    const res = await saveReviewRequestSettingsAction({}, fd({}));
    expect(res.error).toBeTruthy();
    expect(res.error).not.toContain("secret");
  });
});

describe("saveReviewRequestTimingAction", () => {
  it("stores hoursAfter as sendHour and applies optional defaults", async () => {
    prisma.automationSetting.upsert.mockResolvedValue({ id: "as_1" });
    const res = await saveReviewRequestTimingAction({
      hoursAfter: 3,
      messageTemplate: "txt",
      reviewLink: "https://g.page/x",
    });
    expect(res.success).toBeTruthy();
    expect(prisma.automationSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          sendHour: 3,
          messageTemplate: "txt",
          offerValue: "https://g.page/x",
          requireOptIn: false,
          templateName: null,
          templateLanguage: null,
        },
      }),
    );
  });

  it("passes through explicit optional fields", async () => {
    prisma.automationSetting.upsert.mockResolvedValue({ id: "as_1" });
    await saveReviewRequestTimingAction({
      hoursAfter: 5,
      messageTemplate: null,
      reviewLink: null,
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

  it("returns a safe error when the write throws", async () => {
    prisma.automationSetting.upsert.mockRejectedValue(new Error("secret db"));
    const res = await saveReviewRequestTimingAction({
      hoursAfter: 1,
      messageTemplate: null,
      reviewLink: null,
    });
    expect(res.error).toBeTruthy();
    expect(res.error).not.toContain("secret");
  });
});
