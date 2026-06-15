import { describe, it, expect, vi, beforeEach } from "vitest";
import { BUSINESS_A } from "../helpers/factories";

/**
 * Booking-confirmation automation settings (server/booking-confirmation/*).
 * Owner-side settings for the booking_confirmation message. Multi-tenant:
 * read + write are keyed by the authenticated tenant's businessId.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof import("../helpers/prisma-mock").createPrismaMock>;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireTenant = vi.fn(async () => ({ businessId: BUSINESS_A }));
vi.mock("@/server/auth/session", () => ({
  requireTenant: (...a: unknown[]) => requireTenant(...(a as [])),
}));

import { resetPrismaMock } from "../helpers/prisma-mock";
import { saveBookingConfirmationSettingsAction } from "@/server/booking-confirmation/actions";
import { getBookingConfirmationSetting } from "@/server/booking-confirmation/queries";

beforeEach(() => {
  resetPrismaMock(prisma);
  requireTenant.mockReset().mockResolvedValue({ businessId: BUSINESS_A });
  prisma.automationSetting.upsert.mockResolvedValue({});
});

describe("getBookingConfirmationSetting", () => {
  it("reads the setting by the scoped composite key", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(null);
    expect(await getBookingConfirmationSetting({ businessId: BUSINESS_A })).toBeNull();
    expect(prisma.automationSetting.findUnique.mock.calls[0][0].where).toEqual({
      businessId_type: { businessId: BUSINESS_A, type: "booking_confirmation" },
    });
  });
});

describe("saveBookingConfirmationSettingsAction", () => {
  it("upserts the setting scoped to the tenant businessId", async () => {
    const res = await saveBookingConfirmationSettingsAction({
      requireOptIn: true,
      templateName: "tpl",
      templateLanguage: "he",
    });
    expect(res.success).toBeTruthy();
    const arg = prisma.automationSetting.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({
      businessId_type: { businessId: BUSINESS_A, type: "booking_confirmation" },
    });
    expect(arg.create.businessId).toBe(BUSINESS_A);
    expect(arg.update).toMatchObject({ requireOptIn: true, templateName: "tpl" });
  });

  it("returns a safe error (no internals) when the upsert throws", async () => {
    prisma.automationSetting.upsert.mockRejectedValue(new Error("db down"));
    const res = await saveBookingConfirmationSettingsAction({ requireOptIn: false });
    expect(res.error).toBeTruthy();
    expect(res.success).toBeUndefined();
  });
});
