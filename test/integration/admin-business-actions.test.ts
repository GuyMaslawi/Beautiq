import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

/**
 * Admin business/owner deletion (server/admin/business-actions.ts).
 *
 * SECURITY:
 *   - requirePlatformAdmin gates the action; a current admin must exist.
 *   - Typed confirmation must equal the business name or slug exactly.
 *   - Deleting the business cascades (single tx); the owner User is only deleted
 *     when asked AND safe: not admin, not self, sole membership.
 *   - Errors are caught and surface a safe Hebrew message (no raw leak).
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requirePlatformAdmin = vi.fn(async () => undefined);
vi.mock("@/server/admin/auth", () => ({
  requirePlatformAdmin: (...a: unknown[]) => requirePlatformAdmin(...(a as [])),
}));

const getCurrentUser = vi.fn();
vi.mock("@/server/auth/session", () => ({
  getCurrentUser: (...a: unknown[]) => getCurrentUser(...(a as [])),
}));

import { adminDeleteBusinessAction } from "@/server/admin/business-actions";

const ADMIN_ID = "usr_admin";
const BIZ_NAME = "סטודיו יופי";
const BIZ_SLUG = "studio-yofi";

function businessRow(members: Array<{ user: { id: string; email: string; isAdmin: boolean } }>) {
  return { id: BUSINESS_A, name: BIZ_NAME, slug: BIZ_SLUG, members };
}

beforeEach(() => {
  resetPrismaMock(prisma);
  requirePlatformAdmin.mockReset().mockResolvedValue(undefined);
  getCurrentUser.mockReset().mockResolvedValue({ id: ADMIN_ID, isAdmin: true });
  prisma.business.delete.mockResolvedValue({});
  prisma.user.deleteMany.mockResolvedValue({ count: 1 });
});

describe("adminDeleteBusinessAction — auth", () => {
  it("requires a platform admin before reading anything", async () => {
    requirePlatformAdmin.mockRejectedValue(new Error("NEXT_REDIRECT:/dashboard"));
    await expect(
      adminDeleteBusinessAction(BUSINESS_A, BIZ_NAME, false),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(prisma.business.findUnique).not.toHaveBeenCalled();
  });

  it("returns a safe error when there is no current admin user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await adminDeleteBusinessAction(BUSINESS_A, BIZ_NAME, false);
    expect(res).toEqual({ error: "אין הרשאה לפעולה זו" });
    expect(prisma.business.findUnique).not.toHaveBeenCalled();
  });
});

describe("adminDeleteBusinessAction — validation", () => {
  it("returns an error when the business is not found", async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    const res = await adminDeleteBusinessAction(BUSINESS_A, BIZ_NAME, false);
    expect(res).toEqual({ error: "העסק לא נמצא" });
    expect(prisma.business.delete).not.toHaveBeenCalled();
  });

  it("rejects an empty confirmation string", async () => {
    prisma.business.findUnique.mockResolvedValue(businessRow([]));
    const res = await adminDeleteBusinessAction(BUSINESS_A, "   ", false);
    expect(res).toEqual({ error: "הטקסט שהוקלד אינו תואם לשם העסק" });
    expect(prisma.business.delete).not.toHaveBeenCalled();
  });

  it("rejects a confirmation that matches neither name nor slug", async () => {
    prisma.business.findUnique.mockResolvedValue(businessRow([]));
    const res = await adminDeleteBusinessAction(BUSINESS_A, "משהו אחר", false);
    expect(res.error).toBe("הטקסט שהוקלד אינו תואם לשם העסק");
    expect(prisma.business.delete).not.toHaveBeenCalled();
  });

  it("accepts a confirmation matching the slug", async () => {
    prisma.business.findUnique.mockResolvedValue(businessRow([]));
    const res = await adminDeleteBusinessAction(BUSINESS_A, ` ${BIZ_SLUG} `, false);
    expect(res.success).toBe(true);
  });
});

describe("adminDeleteBusinessAction — deletion + owner handling", () => {
  it("deletes the business in a transaction without touching the owner when deleteOwnerUser=false", async () => {
    const owner = { id: "usr_owner", email: "o@x.com", isAdmin: false };
    prisma.business.findUnique.mockResolvedValue(businessRow([{ user: owner }]));

    const res = await adminDeleteBusinessAction(BUSINESS_A, BIZ_NAME, false);
    expect(res).toEqual({ success: true, ownerUserDeleted: false });
    expect(prisma.business.delete).toHaveBeenCalledWith({ where: { id: BUSINESS_A } });
    expect(prisma.businessUser.count).not.toHaveBeenCalled();
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes the sole-membership non-admin owner when deleteOwnerUser=true", async () => {
    const owner = { id: "usr_owner", email: "o@x.com", isAdmin: false };
    prisma.business.findUnique.mockResolvedValue(businessRow([{ user: owner }]));
    prisma.businessUser.count.mockResolvedValue(1);

    const res = await adminDeleteBusinessAction(BUSINESS_A, BIZ_NAME, true);
    expect(res).toEqual({ success: true, ownerUserDeleted: true });
    expect(prisma.businessUser.count).toHaveBeenCalledWith({ where: { userId: "usr_owner" } });
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["usr_owner"] } },
    });
  });

  it("never deletes an owner who belongs to other businesses", async () => {
    const owner = { id: "usr_owner", email: "o@x.com", isAdmin: false };
    prisma.business.findUnique.mockResolvedValue(businessRow([{ user: owner }]));
    prisma.businessUser.count.mockResolvedValue(2);

    const res = await adminDeleteBusinessAction(BUSINESS_A, BIZ_NAME, true);
    expect(res.ownerUserDeleted).toBe(false);
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });

  it("never deletes a platform-admin owner", async () => {
    const owner = { id: "usr_owner_admin", email: "a@x.com", isAdmin: true };
    prisma.business.findUnique.mockResolvedValue(businessRow([{ user: owner }]));

    const res = await adminDeleteBusinessAction(BUSINESS_A, BIZ_NAME, true);
    expect(res.ownerUserDeleted).toBe(false);
    expect(prisma.businessUser.count).not.toHaveBeenCalled();
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });

  it("never deletes the admin performing the action (no self-delete)", async () => {
    const owner = { id: ADMIN_ID, email: "self@x.com", isAdmin: false };
    prisma.business.findUnique.mockResolvedValue(businessRow([{ user: owner }]));

    const res = await adminDeleteBusinessAction(BUSINESS_A, BIZ_NAME, true);
    expect(res.ownerUserDeleted).toBe(false);
    expect(prisma.businessUser.count).not.toHaveBeenCalled();
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });

  it("returns a safe error and reports failure when the transaction throws", async () => {
    prisma.business.findUnique.mockResolvedValue(businessRow([]));
    prisma.business.delete.mockRejectedValue(new Error("db exploded with secret xyz"));

    const res = await adminDeleteBusinessAction(BUSINESS_A, BIZ_NAME, false);
    expect(res).toEqual({ error: "המחיקה נכשלה. נסו שוב או פנו לתמיכה." });
    expect(JSON.stringify(res)).not.toContain("secret");
  });
});
