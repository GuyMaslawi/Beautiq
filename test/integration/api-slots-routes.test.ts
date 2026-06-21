import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

const getCurrentBusiness = vi.fn();
vi.mock("@/server/auth/session", () => ({
  getCurrentBusiness: () => getCurrentBusiness(),
}));

const getDayAvailability = vi.fn();
const getAvailableSlots = vi.fn();
vi.mock("@/server/availability/get-available-slots", () => ({
  getDayAvailability: (a: unknown) => getDayAvailability(a),
  getAvailableSlots: (a: unknown) => getAvailableSlots(a),
}));

// Rate limiter — pass-through by default; a test flips it to simulate 429.
const checkRateLimit = vi.fn<(...a: unknown[]) => boolean>(() => true);
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (key: string, max: number, win: number) =>
    checkRateLimit(key, max, win),
  getClientIp: () => "1.2.3.4",
}));

import { GET as ownerGET } from "@/app/api/owner/slots/route";
import { GET as publicSlotsGET } from "@/app/api/public/[slug]/slots/route";
import { GET as upcomingGET } from "@/app/api/public/[slug]/upcoming-slots/route";

function url(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}
const slugParams = (slug = "studio-yofi") => ({ params: Promise.resolve({ slug }) });

beforeEach(() => {
  resetPrismaMock(prisma);
  getCurrentBusiness.mockReset();
  getDayAvailability.mockReset();
  getAvailableSlots.mockReset();
  checkRateLimit.mockReset().mockReturnValue(true);
});

describe("GET /api/owner/slots", () => {
  it("401 when there is no current business", async () => {
    getCurrentBusiness.mockResolvedValue(null);
    const res = await ownerGET(url("/api/owner/slots?date=2026-07-01&serviceId=s1"));
    expect(res.status).toBe(401);
    expect(getDayAvailability).not.toHaveBeenCalled();
  });

  it("400 on a missing/malformed date or serviceId", async () => {
    getCurrentBusiness.mockResolvedValue({ id: "biz1" });
    expect((await ownerGET(url("/api/owner/slots?serviceId=s1"))).status).toBe(400);
    expect(
      (await ownerGET(url("/api/owner/slots?date=2026-7-1&serviceId=s1"))).status,
    ).toBe(400);
    expect(
      (await ownerGET(url("/api/owner/slots?date=2026-07-01"))).status,
    ).toBe(400);
  });

  it("returns day availability scoped to the session business", async () => {
    getCurrentBusiness.mockResolvedValue({ id: "biz1" });
    getDayAvailability.mockResolvedValue({ open: true, slots: ["09:00", "10:00"] });

    const res = await ownerGET(
      url("/api/owner/slots?date=2026-07-01&serviceId=s1"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ open: true, slots: ["09:00", "10:00"] });
    expect(getDayAvailability).toHaveBeenCalledWith({
      businessId: "biz1",
      date: "2026-07-01",
      serviceId: "s1",
    });
  });
});

describe("GET /api/public/[slug]/slots", () => {
  it("429 when rate-limited", async () => {
    checkRateLimit.mockReturnValue(false);
    const res = await publicSlotsGET(
      url("/api/public/studio-yofi/slots?date=2026-07-01&serviceId=s1"),
      slugParams(),
    );
    expect(res.status).toBe(429);
  });

  it("returns an empty list for a missing/bad date", async () => {
    const res = await publicSlotsGET(
      url("/api/public/studio-yofi/slots?serviceId=s1"),
      slugParams(),
    );
    expect(await res.json()).toEqual({ slots: [] });
    expect(getAvailableSlots).not.toHaveBeenCalled();
  });

  it("returns an empty list for an unknown business slug", async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    const res = await publicSlotsGET(
      url("/api/public/nope/slots?date=2026-07-01&serviceId=s1"),
      slugParams("nope"),
    );
    expect(await res.json()).toEqual({ slots: [] });
  });

  it("returns slots for a valid request", async () => {
    prisma.business.findUnique.mockResolvedValue({ id: "biz1" });
    getAvailableSlots.mockResolvedValue(["09:00", "09:30"]);
    const res = await publicSlotsGET(
      url("/api/public/studio-yofi/slots?date=2026-07-01&serviceId=s1"),
      slugParams(),
    );
    expect(await res.json()).toEqual({ slots: ["09:00", "09:30"] });
    expect(getAvailableSlots).toHaveBeenCalledWith({
      businessId: "biz1",
      date: "2026-07-01",
      serviceId: "s1",
    });
  });
});

describe("GET /api/public/[slug]/upcoming-slots", () => {
  it("429 when rate-limited", async () => {
    checkRateLimit.mockReturnValue(false);
    const res = await upcomingGET(
      url("/api/public/studio-yofi/upcoming-slots?serviceId=s1"),
      slugParams(),
    );
    expect(res.status).toBe(429);
  });

  it("returns empty groups when serviceId is missing", async () => {
    const res = await upcomingGET(
      url("/api/public/studio-yofi/upcoming-slots"),
      slugParams(),
    );
    expect(await res.json()).toEqual({ groups: [] });
  });

  it("returns empty groups for an unknown slug", async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    const res = await upcomingGET(
      url("/api/public/nope/upcoming-slots?serviceId=s1"),
      slugParams("nope"),
    );
    expect(await res.json()).toEqual({ groups: [] });
  });

  it("builds Hebrew-labelled groups for days that have slots", async () => {
    prisma.business.findUnique.mockResolvedValue({ id: "biz1" });
    // First call (today) returns >6 slots so the cap is exercised; rest empty.
    getAvailableSlots
      .mockResolvedValueOnce(["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00"])
      .mockResolvedValue([]);

    const res = await upcomingGET(
      url("/api/public/studio-yofi/upcoming-slots?serviceId=s1"),
      slugParams(),
    );
    const body = await res.json();
    expect(body.groups.length).toBe(1);
    expect(body.groups[0].label).toBe("היום");
    expect(body.groups[0].slots).toHaveLength(6); // capped at MAX_SLOTS_PER_DAY
    expect(getAvailableSlots).toHaveBeenCalledTimes(5); // DAYS_AHEAD
  });

  it("labels day index 1 as מחר and later days as weekdays", async () => {
    prisma.business.findUnique.mockResolvedValue({ id: "biz1" });
    getAvailableSlots
      .mockResolvedValueOnce([]) // today
      .mockResolvedValueOnce(["09:00"]) // tomorrow
      .mockResolvedValueOnce(["10:00"]) // day +2
      .mockResolvedValue([]);

    const res = await upcomingGET(
      url("/api/public/studio-yofi/upcoming-slots?serviceId=s1"),
      slugParams(),
    );
    const body = await res.json();
    const labels = body.groups.map((g: { label: string }) => g.label);
    expect(labels).toContain("מחר");
    expect(labels.some((l: string) => l.startsWith("יום "))).toBe(true);
  });
});
