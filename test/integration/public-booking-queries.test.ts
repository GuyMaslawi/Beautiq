import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { makeBusiness } from "../helpers/factories";

/**
 * Public booking page data (server/public-booking/queries.ts → getPublicBusiness).
 *
 * This is customer-facing and looked up by an untrusted slug. SAFETY:
 *   - lookup is by slug only; a missing business returns null (safe not-found).
 *   - only public-safe fields are selected — never internal/CRM/admin data.
 *   - only ACTIVE services and APPROVED reviews are exposed.
 *   - Prisma Decimal prices are serialized to plain strings for the client.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof import("../helpers/prisma-mock").createPrismaMock>;

import { resetPrismaMock } from "../helpers/prisma-mock";
import { getPublicBusiness } from "@/server/public-booking/queries";

// Fields that must NEVER be selected for a public page.
const FORBIDDEN_FIELDS = [
  "passwordHash",
  "accessTokenEncrypted",
  "accessToken",
  "token",
  "isAdmin",
  "email",
  "normalizedPhone",
  "notes",
];

function makePublicRow(overrides: Record<string, unknown> = {}) {
  return {
    ...makeBusiness(),
    services: [
      {
        id: "svc_1",
        name: "מניקור",
        description: null,
        durationMinutes: 60,
        price: new Prisma.Decimal(150),
        requiresDeposit: true,
        depositAmount: new Prisma.Decimal(50),
      },
    ],
    cancellationPolicy: null,
    galleryImages: [{ id: "g1", imageUrl: "https://x/i.jpg", caption: null }],
    clientReviews: [
      { id: "r1", clientName: "לקוחה", reviewText: "מעולה", rating: 5 },
    ],
    availabilityRules: [
      { weekday: 0, startMinutes: 540, endMinutes: 1020 },
      { weekday: 0, startMinutes: 1080, endMinutes: 1200 },
      { weekday: 2, startMinutes: 600, endMinutes: 900 },
    ],
    ...overrides,
  };
}

beforeEach(() => resetPrismaMock(prisma));

describe("getPublicBusiness", () => {
  it("looks the business up by slug and returns null when missing", async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    const res = await getPublicBusiness("does-not-exist");
    expect(res).toBeNull();
    expect(prisma.business.findUnique.mock.calls[0][0].where).toEqual({
      slug: "does-not-exist",
    });
  });

  it("selects only public-safe fields (no CRM/admin/secret fields)", async () => {
    prisma.business.findUnique.mockResolvedValue(makePublicRow());
    await getPublicBusiness("studio-yofi");
    const select = prisma.business.findUnique.mock.calls[0][0].select as Record<
      string,
      unknown
    >;
    for (const field of FORBIDDEN_FIELDS) {
      expect(select).not.toHaveProperty(field);
    }
    // Sanity: it still selects presentation fields.
    expect(select).toMatchObject({ name: true, slug: true, showPrices: true });
  });

  it("only requests ACTIVE services and APPROVED reviews", async () => {
    prisma.business.findUnique.mockResolvedValue(makePublicRow());
    await getPublicBusiness("studio-yofi");
    const select = prisma.business.findUnique.mock.calls[0][0].select as {
      services: { where: unknown };
      clientReviews: { where: unknown };
    };
    expect(select.services.where).toEqual({ isActive: true });
    expect(select.clientReviews.where).toEqual({ isApproved: true });
  });

  it("serializes Decimal prices/deposits to plain strings", async () => {
    prisma.business.findUnique.mockResolvedValue(makePublicRow());
    const res = await getPublicBusiness("studio-yofi");
    expect(res!.services[0].price).toBe("150");
    expect(res!.services[0].depositAmount).toBe("50");
    expect(typeof res!.services[0].price).toBe("string");
  });

  it("groups availability rules into days with multiple windows", async () => {
    prisma.business.findUnique.mockResolvedValue(makePublicRow());
    const res = await getPublicBusiness("studio-yofi");
    expect(res!.availabilityDays).toEqual([
      {
        weekday: 0,
        windows: [
          { startMinutes: 540, endMinutes: 1020 },
          { startMinutes: 1080, endMinutes: 1200 },
        ],
      },
      { weekday: 2, windows: [{ startMinutes: 600, endMinutes: 900 }] },
    ]);
  });

  it("returns null cancellation policy when it is disabled", async () => {
    prisma.business.findUnique.mockResolvedValue(
      makePublicRow({
        cancellationPolicy: {
          enabled: false,
          policyText: "x",
          lateCancellationHours: 24,
          lateCancellationFeeType: "fixed",
          lateCancellationFeeAmount: new Prisma.Decimal(30),
          lateCancellationFeePercentage: null,
        },
      }),
    );
    const res = await getPublicBusiness("studio-yofi");
    expect(res!.cancellationPolicy).toBeNull();
  });

  it("exposes an enabled cancellation policy with serialized amounts", async () => {
    prisma.business.findUnique.mockResolvedValue(
      makePublicRow({
        cancellationPolicy: {
          enabled: true,
          policyText: "מדיניות",
          lateCancellationHours: 24,
          lateCancellationFeeType: "fixed",
          lateCancellationFeeAmount: new Prisma.Decimal(30),
          lateCancellationFeePercentage: null,
        },
      }),
    );
    const res = await getPublicBusiness("studio-yofi");
    expect(res!.cancellationPolicy).toMatchObject({
      enabled: true,
      lateCancellationFeeAmount: "30",
    });
  });

  it("returns safe empty arrays when there are no services/reviews/rules", async () => {
    prisma.business.findUnique.mockResolvedValue(
      makePublicRow({
        services: [],
        galleryImages: [],
        clientReviews: [],
        availabilityRules: [],
      }),
    );
    const res = await getPublicBusiness("studio-yofi");
    expect(res!.services).toEqual([]);
    expect(res!.reviews).toEqual([]);
    expect(res!.availabilityDays).toEqual([]);
  });
});
