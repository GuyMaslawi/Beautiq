import { describe, it, expect, beforeEach } from "vitest";
import { BUSINESS_A } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});

import { vi } from "vitest";
import { resetPrismaMock } from "../helpers/prisma-mock";
import { ensureDefaultAutomationSettings } from "@/server/automations/defaults";

const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof import("../helpers/prisma-mock").createPrismaMock>;

beforeEach(() => resetPrismaMock(prisma));

describe("ensureDefaultAutomationSettings", () => {
  it("seeds the three operational automations enabled, with managed templates, and NEVER win-back", async () => {
    prisma.automationSetting.findMany.mockResolvedValue([]);
    prisma.automationSetting.createMany.mockResolvedValue({ count: 3 });

    await ensureDefaultAutomationSettings(BUSINESS_A);

    expect(prisma.automationSetting.createMany).toHaveBeenCalledTimes(1);
    const arg = prisma.automationSetting.createMany.mock.calls[0][0];
    const rows = arg.data as Array<Record<string, unknown>>;
    const types = rows.map((r) => r.type);

    expect(types).toEqual(
      expect.arrayContaining(["booking_confirmation", "morning_reminder", "review_request"]),
    );
    // Marketing / win-back is never enabled by default.
    expect(types).not.toContain("win_back");

    for (const row of rows) {
      expect(row.enabled).toBe(true);
      // Service notifications require consent and use Allura's managed templates.
      expect(row.requireOptIn).toBe(true);
      expect(row.templateName).toBeTruthy();
      expect(row.templateStatus).toBe("approved");
      expect(row.businessId).toBe(BUSINESS_A);
    }
  });

  it("is idempotent — never recreates settings that already exist", async () => {
    prisma.automationSetting.findMany.mockResolvedValue([
      { type: "booking_confirmation" },
      { type: "morning_reminder" },
      { type: "review_request" },
    ]);

    await ensureDefaultAutomationSettings(BUSINESS_A);

    expect(prisma.automationSetting.createMany).not.toHaveBeenCalled();
  });

  it("only fills in the missing operational automations", async () => {
    prisma.automationSetting.findMany.mockResolvedValue([
      { type: "booking_confirmation" },
    ]);
    prisma.automationSetting.createMany.mockResolvedValue({ count: 2 });

    await ensureDefaultAutomationSettings(BUSINESS_A);

    const rows = prisma.automationSetting.createMany.mock.calls[0][0].data as Array<{
      type: string;
    }>;
    const types = rows.map((r) => r.type);
    expect(types).toEqual(
      expect.arrayContaining(["morning_reminder", "review_request"]),
    );
    expect(types).not.toContain("booking_confirmation");
  });
});
