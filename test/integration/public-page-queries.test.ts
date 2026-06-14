import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getPublicPageSettings,
  getGalleryImages,
  getClientReviews,
} from "@/server/public-page/queries";
import { BUSINESS_A, BUSINESS_B, makeBusiness } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<
  typeof import("../helpers/prisma-mock").createPrismaMock
>;
beforeEach(() => resetPrismaMock(prisma));

import { resetPrismaMock } from "../helpers/prisma-mock";

// Fields that must NEVER appear in any public-page select clause.
const FORBIDDEN_FIELDS = [
  "passwordHash",
  "accessTokenEncrypted",
  "accessToken",
  "token",
  "wabaId",
  "phoneNumberId",
  "isAdmin",
  "marketingOptIn",
  "whatsappOptIn",
  "normalizedPhone",
  "notes",
];

function assertNoForbiddenSelect(select: Record<string, unknown> | undefined) {
  if (!select) return;
  for (const field of FORBIDDEN_FIELDS) {
    expect(select).not.toHaveProperty(field);
  }
}

describe("getPublicPageSettings", () => {
  it("is scoped by the tenant businessId (never by bare slug/id leak)", async () => {
    prisma.business.findUnique.mockResolvedValue(makeBusiness());
    await getPublicPageSettings({ businessId: BUSINESS_A });

    const arg = prisma.business.findUnique.mock.calls[0][0];
    expect(arg.where).toEqual({ id: BUSINESS_A });
  });

  it("does not select internal-only / sensitive fields", async () => {
    prisma.business.findUnique.mockResolvedValue(makeBusiness());
    await getPublicPageSettings({ businessId: BUSINESS_A });

    const arg = prisma.business.findUnique.mock.calls[0][0];
    assertNoForbiddenSelect(arg.select);
    // Sanity: it should still select the public-safe presentation fields.
    expect(arg.select).toMatchObject({ name: true, slug: true, showPrices: true });
  });

  it("returns null when the business is missing", async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    const result = await getPublicPageSettings({ businessId: BUSINESS_A });
    expect(result).toBeNull();
  });

  it("uses the businessId from the tenant, not a hardcoded value", async () => {
    prisma.business.findUnique.mockResolvedValue(makeBusiness({ id: BUSINESS_B }));
    await getPublicPageSettings({ businessId: BUSINESS_B });
    expect(prisma.business.findUnique.mock.calls[0][0].where).toEqual({
      id: BUSINESS_B,
    });
  });
});

describe("getGalleryImages", () => {
  it("filters by businessId and only selects public-safe fields", async () => {
    prisma.galleryImage.findMany.mockResolvedValue([]);
    await getGalleryImages({ businessId: BUSINESS_A });

    const arg = prisma.galleryImage.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ businessId: BUSINESS_A });
    expect(arg.select).toEqual({
      id: true,
      imageUrl: true,
      caption: true,
      sortOrder: true,
    });
    assertNoForbiddenSelect(arg.select);
  });

  it("orders by sortOrder then createdAt", async () => {
    prisma.galleryImage.findMany.mockResolvedValue([]);
    await getGalleryImages({ businessId: BUSINESS_A });
    const arg = prisma.galleryImage.findMany.mock.calls[0][0];
    expect(arg.orderBy).toEqual([{ sortOrder: "asc" }, { createdAt: "asc" }]);
  });
});

describe("getClientReviews", () => {
  it("filters by businessId and never selects client PII (phone/notes)", async () => {
    prisma.clientReview.findMany.mockResolvedValue([]);
    await getClientReviews({ businessId: BUSINESS_A });

    const arg = prisma.clientReview.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ businessId: BUSINESS_A });
    assertNoForbiddenSelect(arg.select);
    // clientName is the only name field exposed — no phone, no normalizedPhone.
    expect(arg.select).toHaveProperty("clientName", true);
    expect(arg.select).not.toHaveProperty("phone");
  });

  it("scopes a different tenant correctly (no cross-tenant leak)", async () => {
    prisma.clientReview.findMany.mockResolvedValue([]);
    await getClientReviews({ businessId: BUSINESS_B });
    expect(prisma.clientReview.findMany.mock.calls[0][0].where).toEqual({
      businessId: BUSINESS_B,
    });
  });
});
