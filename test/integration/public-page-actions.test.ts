import { describe, it, expect, vi, beforeEach } from "vitest";
import { BUSINESS_A, BUSINESS_B } from "../helpers/factories";

/**
 * Public-page management server actions (server/public-page/actions.ts).
 *
 * These are authenticated owner actions. SECURITY (CLAUDE.md §10):
 *   - businessId ALWAYS comes from the authenticated tenant, never from form input.
 *   - destructive ops (delete gallery image / review) use deleteMany scoped by
 *     businessId so a cross-tenant id cannot delete another business's row.
 *   - inputs are validated (name required, hex color, image url required).
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
import {
  updatePublicProfileAction,
  updateBrandingAction,
  updateVisibilityAction,
  addGalleryImageAction,
  deleteGalleryImageAction,
  deleteClientReviewAction,
} from "@/server/public-page/actions";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

beforeEach(() => {
  resetPrismaMock(prisma);
  requireTenant.mockReset().mockResolvedValue({ businessId: BUSINESS_A });
  prisma.business.update.mockResolvedValue({});
  prisma.galleryImage.create.mockResolvedValue({});
  prisma.galleryImage.deleteMany.mockResolvedValue({ count: 1 });
  prisma.galleryImage.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
  prisma.clientReview.deleteMany.mockResolvedValue({ count: 1 });
});

describe("updatePublicProfileAction", () => {
  it("rejects an empty business name", async () => {
    const res = await updatePublicProfileAction({}, fd({ name: "  " }));
    expect(res.errors?.name).toBeTruthy();
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it("updates the business scoped to the tenant (ignores any form businessId)", async () => {
    const res = await updatePublicProfileAction(
      {},
      fd({ name: "סטודיו", businessId: BUSINESS_B, phone: "050-000-0000" }),
    );
    expect(res.success).toBeTruthy();
    const arg = prisma.business.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: BUSINESS_A });
    // the client-supplied BUSINESS_B is never used
    expect(JSON.stringify(arg.where)).not.toContain(BUSINESS_B);
  });

  it("returns a generic error when the update throws (no leak of internals)", async () => {
    prisma.business.update.mockRejectedValue(new Error("db down"));
    const res = await updatePublicProfileAction({}, fd({ name: "סטודיו" }));
    expect(res.formError).toBeTruthy();
    expect(res.success).toBeUndefined();
  });
});

describe("updateBrandingAction", () => {
  it("rejects an invalid hex color", async () => {
    const res = await updateBrandingAction({}, fd({ brandColor: "red" }));
    expect(res.errors?.brandColor).toBeTruthy();
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it("accepts a valid hex color and scopes the update to the tenant", async () => {
    const res = await updateBrandingAction({}, fd({ brandColor: "#aabbcc" }));
    expect(res.success).toBeTruthy();
    expect(prisma.business.update.mock.calls[0][0].where).toEqual({ id: BUSINESS_A });
  });
});

describe("updateVisibilityAction", () => {
  it("writes the boolean toggles scoped to the tenant", async () => {
    const res = await updateVisibilityAction(
      {},
      fd({ showServices: "true", showPrices: "false" }),
    );
    expect(res.success).toBeTruthy();
    const arg = prisma.business.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: BUSINESS_A });
    expect(arg.data.showServices).toBe(true);
    expect(arg.data.showPrices).toBe(false);
  });
});

describe("addGalleryImageAction", () => {
  it("requires an image url", async () => {
    const res = await addGalleryImageAction({}, fd({ imageUrl: "" }));
    expect(res.errors?.imageUrl).toBeTruthy();
    expect(prisma.galleryImage.create).not.toHaveBeenCalled();
  });

  it("creates the image scoped to the tenant businessId with the next sort order", async () => {
    const res = await addGalleryImageAction(
      {},
      fd({ imageUrl: "https://x/i.jpg", caption: "כיתוב" }),
    );
    expect(res.success).toBeTruthy();
    const arg = prisma.galleryImage.create.mock.calls[0][0];
    expect(arg.data.businessId).toBe(BUSINESS_A);
    expect(arg.data.sortOrder).toBe(3); // (_max 2) + 1
    expect(prisma.galleryImage.aggregate.mock.calls[0][0].where).toEqual({
      businessId: BUSINESS_A,
    });
  });
});

describe("deleteGalleryImageAction / deleteClientReviewAction", () => {
  it("deletes a gallery image scoped by businessId (cross-tenant id is a no-op)", async () => {
    await deleteGalleryImageAction("img_from_other_tenant");
    expect(prisma.galleryImage.deleteMany).toHaveBeenCalledWith({
      where: { id: "img_from_other_tenant", businessId: BUSINESS_A },
    });
  });

  it("deletes a client review scoped by businessId", async () => {
    await deleteClientReviewAction("rev_from_other_tenant");
    expect(prisma.clientReview.deleteMany).toHaveBeenCalledWith({
      where: { id: "rev_from_other_tenant", businessId: BUSINESS_A },
    });
  });

  it("returns a safe error object when delete throws", async () => {
    prisma.galleryImage.deleteMany.mockRejectedValue(new Error("db"));
    const res = await deleteGalleryImageAction("img_1");
    expect(res.error).toBeTruthy();
  });
});
