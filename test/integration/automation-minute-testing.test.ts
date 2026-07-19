import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Prisma } from "@prisma/client";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { makeBusiness, makeClient, BUSINESS_A } from "../helpers/factories";

// --- Mocked Prisma (shared singleton) -------------------------------------
vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>).__prismaMock as ReturnType<
  typeof createPrismaMock
>;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireCurrentBusiness = vi.fn();
const getCurrentUser = vi.fn();
vi.mock("@/server/auth/session", () => ({
  requireCurrentBusiness: () => requireCurrentBusiness(),
  getCurrentUser: () => getCurrentUser(),
}));

import {
  isMinuteTestingAllowed,
  resolveTimingUnit,
} from "@/lib/automation/minute-testing";
import { getEligibleClients } from "@/server/win-back-automation/eligibility";
import { saveWinBackAutomationSetting } from "@/server/win-back-automation/actions";

const TENANT = { businessId: BUSINESS_A };

const DAY_OPTIONS = {
  thresholdDays: 45,
  cooldownDays: 30,
  requireOptIn: true,
};

beforeEach(() => {
  resetPrismaMock(prisma);
  requireCurrentBusiness.mockReset().mockResolvedValue(makeBusiness({ id: BUSINESS_A }));
  getCurrentUser.mockReset().mockResolvedValue({ id: "u1", isAdmin: false });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// 1. Gate: who/when may use minute mode
// ---------------------------------------------------------------------------

describe("isMinuteTestingAllowed", () => {
  it("allows minute mode in non-production (dev/test) for anyone", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isMinuteTestingAllowed()).toBe(true);
    expect(isMinuteTestingAllowed({ isAdmin: false })).toBe(true);
  });

  it("blocks regular owners in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_AUTOMATION_MINUTE_TESTING", "");
    expect(isMinuteTestingAllowed({ isAdmin: false })).toBe(false);
  });

  it("allows admins in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_AUTOMATION_MINUTE_TESTING", "");
    expect(isMinuteTestingAllowed({ isAdmin: true })).toBe(true);
  });

  it("allows owners in production only when the env flag is enabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_AUTOMATION_MINUTE_TESTING", "true");
    expect(isMinuteTestingAllowed({ isAdmin: false })).toBe(true);
  });
});

describe("resolveTimingUnit", () => {
  it("falls back to days when minutes are not allowed (production safety)", () => {
    expect(resolveTimingUnit("minutes", false)).toBe("days");
  });
  it("honors minutes only when allowed", () => {
    expect(resolveTimingUnit("minutes", true)).toBe("minutes");
  });
  it("defaults to days for an unset/days unit", () => {
    expect(resolveTimingUnit("days", true)).toBe("days");
    expect(resolveTimingUnit(null, true)).toBe("days");
    expect(resolveTimingUnit(undefined, true)).toBe("days");
  });
});

// ---------------------------------------------------------------------------
// 2. Eligibility windows: days unchanged, minutes shrink the windows
// ---------------------------------------------------------------------------

describe("getEligibleClients — timing windows", () => {
  function getWhere() {
    return prisma.client.findMany.mock.calls[0][0].where;
  }

  it("uses a day-based threshold/cooldown by default (no timingUnit)", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    const before = Date.now();
    await getEligibleClients(TENANT, DAY_OPTIONS);
    const where = getWhere();

    const thresholdLt = where.bookings.some.startTime.lt.getTime();
    const cooldownGt = where.automationMessages.none.createdAt.gt.getTime();

    // ~45 days back (allow a few seconds of clock drift during the test)
    expect(before - thresholdLt).toBeGreaterThan(44 * 24 * 60 * 60 * 1000);
    expect(before - thresholdLt).toBeLessThan(46 * 24 * 60 * 60 * 1000);
    // ~30 days back
    expect(before - cooldownGt).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
  });

  it("uses a minute-based threshold/cooldown in minute mode", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    const before = Date.now();
    await getEligibleClients(TENANT, {
      ...DAY_OPTIONS,
      timingUnit: "minutes",
      thresholdMinutes: 10,
      cooldownMinutes: 2,
    });
    const where = getWhere();

    const thresholdAgoMs = before - where.bookings.some.startTime.lt.getTime();
    const cooldownAgoMs = before - where.automationMessages.none.createdAt.gt.getTime();

    // 10 minutes ≈ 600_000ms, far smaller than even one day
    expect(thresholdAgoMs).toBeGreaterThanOrEqual(10 * 60 * 1000 - 5000);
    expect(thresholdAgoMs).toBeLessThan(11 * 60 * 1000);
    // 2 minutes cooldown
    expect(cooldownAgoMs).toBeGreaterThanOrEqual(2 * 60 * 1000 - 5000);
    expect(cooldownAgoMs).toBeLessThan(3 * 60 * 1000);
  });

  it("falls back to day math when timingUnit=minutes but no minute values given", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    const before = Date.now();
    await getEligibleClients(TENANT, { ...DAY_OPTIONS, timingUnit: "minutes" });
    const where = getWhere();
    const thresholdAgoMs = before - where.bookings.some.startTime.lt.getTime();
    expect(thresholdAgoMs).toBeGreaterThan(44 * 24 * 60 * 60 * 1000);
  });

  it("minute mode keeps ALL other safety filters (unsubscribed opt-out, future-booking, cooldown)", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await getEligibleClients(TENANT, {
      ...DAY_OPTIONS,
      timingUnit: "minutes",
      thresholdMinutes: 10,
      cooldownMinutes: 2,
    });
    const where = getWhere();

    expect(where.businessId).toBe(BUSINESS_A);
    // Opt-out model: only an explicit STOP (unsubscribedAt) excludes a client.
    // The old per-message opt-in gates were removed, so neither marketingOptIn
    // nor whatsappOptIn appears in the query — even with requireOptIn=true.
    expect(where.unsubscribedAt).toBeNull();
    expect(where.normalizedPhone).toEqual({ startsWith: "+972" });
    expect(where.marketingOptIn).toBeUndefined();
    expect(where.whatsappOptIn).toBeUndefined();
    expect(where.bookings.none).toMatchObject({
      status: { in: ["pending", "approved"] },
    });
    // cooldown dedup filter still present in minute mode (not bypassed)
    expect(where.automationMessages.none).toMatchObject({
      type: "win_back",
      status: { in: ["queued", "sent", "delivered", "read"] },
    });
  });

  it("minute mode does not bypass cooldown unless ignoreCooldown (admin) is set", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await getEligibleClients(TENANT, {
      ...DAY_OPTIONS,
      timingUnit: "minutes",
      thresholdMinutes: 10,
      cooldownMinutes: 2,
      ignoreCooldown: true,
    });
    const where = getWhere();
    expect(where.automationMessages).toBeUndefined();
  });

  it("returns eligible clients in minute mode using the same mapping (no guard skipped)", async () => {
    const client = makeClient({ id: "cli_1", fullName: "דנה", normalizedPhone: "+972501234567" });
    prisma.client.findMany.mockResolvedValue([
      {
        ...client,
        bookings: [
          {
            id: "bkg_old",
            status: "completed",
            startTime: new Date("2026-01-01T09:00:00Z"),
            priceSnapshot: new Prisma.Decimal(200),
            service: { name: "מניקור" },
          },
        ],
      },
    ]);
    const result = await getEligibleClients(TENANT, {
      ...DAY_OPTIONS,
      timingUnit: "minutes",
      thresholdMinutes: 10,
      cooldownMinutes: 2,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("cli_1");
  });
});

// ---------------------------------------------------------------------------
// 3. Save action gating: owners can't enable minutes in production
// ---------------------------------------------------------------------------

describe("saveWinBackAutomationSetting — minute-mode gating", () => {
  const baseInput = {
    enabled: true,
    thresholdDays: 45,
    sendHour: 10,
    messageTemplate: null,
    offerType: "none" as const,
    offerValue: null,
    cooldownDays: 30,
    requireOptIn: true,
    templateName: null,
    templateLanguage: "he",
  };

  function savedData() {
    return prisma.automationSetting.upsert.mock.calls[0][0].update;
  }

  it("forces days for a regular owner in production (drops minute values)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_AUTOMATION_MINUTE_TESTING", "");
    getCurrentUser.mockResolvedValue({ id: "u1", isAdmin: false });
    prisma.automationSetting.upsert.mockResolvedValue({});

    const res = await saveWinBackAutomationSetting({
      ...baseInput,
      timingUnit: "minutes",
      testThresholdMinutes: 5,
      testCooldownMinutes: 1,
    });

    expect(res.success).toBe(true);
    const data = savedData();
    expect(data.timingUnit).toBe("days");
    expect(data.testThresholdMinutes).toBeNull();
    expect(data.testCooldownMinutes).toBeNull();
  });

  it("persists minutes for an admin in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_AUTOMATION_MINUTE_TESTING", "");
    getCurrentUser.mockResolvedValue({ id: "admin", isAdmin: true });
    prisma.automationSetting.upsert.mockResolvedValue({});

    await saveWinBackAutomationSetting({
      ...baseInput,
      timingUnit: "minutes",
      testThresholdMinutes: 5,
      testCooldownMinutes: 1,
    });

    const data = savedData();
    expect(data.timingUnit).toBe("minutes");
    expect(data.testThresholdMinutes).toBe(5);
    expect(data.testCooldownMinutes).toBe(1);
  });

  it("persists minutes for an owner in production when the env flag is enabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_AUTOMATION_MINUTE_TESTING", "true");
    getCurrentUser.mockResolvedValue({ id: "u1", isAdmin: false });
    prisma.automationSetting.upsert.mockResolvedValue({});

    await saveWinBackAutomationSetting({
      ...baseInput,
      timingUnit: "minutes",
      testThresholdMinutes: 7,
      testCooldownMinutes: 2,
    });

    const data = savedData();
    expect(data.timingUnit).toBe("minutes");
    expect(data.testThresholdMinutes).toBe(7);
  });

  it("defaults existing day-based saves to timingUnit=days (backwards-compatible)", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", isAdmin: false });
    prisma.automationSetting.upsert.mockResolvedValue({});

    await saveWinBackAutomationSetting(baseInput);

    const data = savedData();
    expect(data.timingUnit).toBe("days");
    expect(data.testThresholdMinutes).toBeNull();
    expect(data.thresholdDays).toBe(45);
  });
});
