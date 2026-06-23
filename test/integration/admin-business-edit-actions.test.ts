import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

/**
 * Admin business/owner edit actions (server/admin/business-edit-actions.ts).
 *
 * SECURITY/TENANCY:
 *   - Every action requires a platform admin (checked before any read).
 *   - Business edit validates name/slug/phone, and enforces slug uniqueness
 *     against OTHER businesses only.
 *   - Owner edit resolves THIS business's owner via BusinessUser (never a
 *     client-supplied user id), validates email, and enforces email uniqueness.
 *   - DB errors surface a safe Hebrew message without leaking internals.
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

import {
  adminUpdateBusinessAction,
  adminUpdateOwnerAction,
  type AdminUpdateBusinessState,
  type AdminUpdateOwnerState,
} from "@/server/admin/business-edit-actions";

function fd(fields: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, x));
    else f.set(k, v);
  }
  return f;
}

const EMPTY_BIZ: AdminUpdateBusinessState = {};
const EMPTY_OWNER: AdminUpdateOwnerState = {};

const VALID_BIZ = {
  name: "סטודיו יופי",
  slug: "studio-yofi",
  phone: "0501234567",
};

beforeEach(() => {
  resetPrismaMock(prisma);
  requirePlatformAdmin.mockReset().mockResolvedValue(undefined);
});

// ===========================================================================
// adminUpdateBusinessAction
// ===========================================================================

describe("adminUpdateBusinessAction", () => {
  it("requires a platform admin before reading", async () => {
    requirePlatformAdmin.mockRejectedValue(new Error("NEXT_REDIRECT:/dashboard"));
    await expect(
      adminUpdateBusinessAction(BUSINESS_A, EMPTY_BIZ, fd(VALID_BIZ)),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(prisma.business.findUnique).not.toHaveBeenCalled();
  });

  it("returns formError when the business does not exist", async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    const res = await adminUpdateBusinessAction(BUSINESS_A, EMPTY_BIZ, fd(VALID_BIZ));
    expect(res).toEqual({ formError: "העסק לא נמצא" });
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it("validates required name and slug", async () => {
    prisma.business.findUnique.mockResolvedValue({ id: BUSINESS_A, slug: "studio-yofi" });
    const res = await adminUpdateBusinessAction(
      BUSINESS_A,
      EMPTY_BIZ,
      fd({ name: "", slug: "" }),
    );
    expect(res.fieldErrors?.name).toBe("יש למלא שם עסק");
    expect(res.fieldErrors?.slug).toBe("יש למלא כתובת קישור");
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it("rejects a malformed slug", async () => {
    prisma.business.findUnique.mockResolvedValue({ id: BUSINESS_A, slug: "studio-yofi" });
    const res = await adminUpdateBusinessAction(
      BUSINESS_A,
      EMPTY_BIZ,
      fd({ name: "x", slug: "Bad Slug!" }),
    );
    expect(res.fieldErrors?.slug).toContain("הקישור חייב להכיל");
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid Israeli phone", async () => {
    prisma.business.findUnique.mockResolvedValue({ id: BUSINESS_A, slug: "studio-yofi" });
    const res = await adminUpdateBusinessAction(
      BUSINESS_A,
      EMPTY_BIZ,
      fd({ ...VALID_BIZ, phone: "123" }),
    );
    expect(res.fieldErrors?.phone).toBe("מספר הטלפון לא נראה תקין");
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid brand color", async () => {
    prisma.business.findUnique.mockResolvedValue({ id: BUSINESS_A, slug: "studio-yofi" });
    const res = await adminUpdateBusinessAction(
      BUSINESS_A,
      EMPTY_BIZ,
      fd({ ...VALID_BIZ, brandColor: "notacolor" }),
    );
    expect(res.fieldErrors?.brandColor).toBeDefined();
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it("blocks a slug already taken by another business", async () => {
    prisma.business.findUnique
      .mockResolvedValueOnce({ id: BUSINESS_A, slug: "old-slug" }) // existing lookup
      .mockResolvedValueOnce({ id: "biz_other" }); // slug owner lookup
    const res = await adminUpdateBusinessAction(
      BUSINESS_A,
      EMPTY_BIZ,
      fd({ ...VALID_BIZ, slug: "studio-yofi" }),
    );
    expect(res.fieldErrors?.slug).toBe("כתובת הקישור כבר תפוסה על ידי עסק אחר");
    // slug uniqueness lookup used the new slug
    const slugArg = prisma.business.findUnique.mock.calls[1][0] as {
      where: { slug: string };
    };
    expect(slugArg.where.slug).toBe("studio-yofi");
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it("does not run a uniqueness check when the slug is unchanged", async () => {
    prisma.business.findUnique.mockResolvedValue({ id: BUSINESS_A, slug: "studio-yofi" });
    prisma.business.update.mockResolvedValue({});
    const res = await adminUpdateBusinessAction(BUSINESS_A, EMPTY_BIZ, fd(VALID_BIZ));
    expect(res).toEqual({ success: true });
    // only the existing lookup ran — no second findUnique for slug
    expect(prisma.business.findUnique).toHaveBeenCalledTimes(1);
  });

  it("saves all fields, lowercases the slug, nulls blanks, and parses toggles", async () => {
    prisma.business.findUnique.mockResolvedValue({ id: BUSINESS_A, slug: "old-slug" });
    prisma.business.findUnique
      .mockResolvedValueOnce({ id: BUSINESS_A, slug: "old-slug" })
      .mockResolvedValueOnce(null); // new slug is free
    prisma.business.update.mockResolvedValue({});

    const res = await adminUpdateBusinessAction(
      BUSINESS_A,
      EMPTY_BIZ,
      fd({
        name: "סטודיו יופי",
        slug: "NEW-Slug",
        phone: "",
        city: "",
        description: "תיאור",
        showServices: ["false", "true"],
        showPrices: "false",
      }),
    );
    expect(res).toEqual({ success: true });
    const data = (prisma.business.update.mock.calls[0][0] as { data: Record<string, unknown> })
      .data;
    expect(data.slug).toBe("new-slug");
    expect(data.phone).toBeNull();
    expect(data.city).toBeNull();
    expect(data.description).toBe("תיאור");
    expect(data.showServices).toBe(true);
    expect(data.showPrices).toBe(false);
    expect(data.timezone).toBe("Asia/Jerusalem");
  });

  it("maps a unique-constraint DB error to a slug field error", async () => {
    prisma.business.findUnique.mockResolvedValue({ id: BUSINESS_A, slug: "studio-yofi" });
    prisma.business.update.mockRejectedValue(new Error("Unique constraint failed"));
    const res = await adminUpdateBusinessAction(BUSINESS_A, EMPTY_BIZ, fd(VALID_BIZ));
    expect(res.fieldErrors?.slug).toBe("כתובת הקישור כבר תפוסה על ידי עסק אחר");
  });

  it("maps any other DB error to a safe generic formError (no leak)", async () => {
    prisma.business.findUnique.mockResolvedValue({ id: BUSINESS_A, slug: "studio-yofi" });
    prisma.business.update.mockRejectedValue(new Error("db down secretZZZ"));
    const res = await adminUpdateBusinessAction(BUSINESS_A, EMPTY_BIZ, fd(VALID_BIZ));
    expect(res).toEqual({ formError: "משהו השתבש. יש לנסות שוב בעוד רגע" });
    expect(JSON.stringify(res)).not.toContain("secretZZZ");
  });
});

// ===========================================================================
// adminUpdateOwnerAction
// ===========================================================================

describe("adminUpdateOwnerAction", () => {
  function ownerMembership(email = "owner@x.com", id = "usr_owner") {
    return { user: { id, email } };
  }

  it("requires a platform admin before reading", async () => {
    requirePlatformAdmin.mockRejectedValue(new Error("NEXT_REDIRECT:/dashboard"));
    await expect(
      adminUpdateOwnerAction(BUSINESS_A, EMPTY_OWNER, fd({ email: "a@b.com" })),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(prisma.businessUser.findFirst).not.toHaveBeenCalled();
  });

  it("returns formError when the business has no owner", async () => {
    prisma.businessUser.findFirst.mockResolvedValue(null);
    const res = await adminUpdateOwnerAction(BUSINESS_A, EMPTY_OWNER, fd({ email: "a@b.com" }));
    expect(res).toEqual({ formError: "לא נמצא בעלים לעסק זה" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("resolves the owner scoped by businessId + role=owner", async () => {
    prisma.businessUser.findFirst.mockResolvedValue(ownerMembership());
    prisma.user.update.mockResolvedValue({});
    await adminUpdateOwnerAction(
      BUSINESS_A,
      EMPTY_OWNER,
      fd({ name: "יעל", email: "owner@x.com" }),
    );
    const arg = prisma.businessUser.findFirst.mock.calls[0][0] as {
      where: { businessId: string; role: string };
    };
    expect(arg.where.businessId).toBe(BUSINESS_A);
    expect(arg.where.role).toBe("owner");
  });

  it("validates a required, well-formed email", async () => {
    prisma.businessUser.findFirst.mockResolvedValue(ownerMembership());
    const empty = await adminUpdateOwnerAction(BUSINESS_A, EMPTY_OWNER, fd({ email: "" }));
    expect(empty.fieldErrors?.email).toBe("יש למלא אימייל");
    const bad = await adminUpdateOwnerAction(BUSINESS_A, EMPTY_OWNER, fd({ email: "nope" }));
    expect(bad.fieldErrors?.email).toBe("כתובת האימייל לא נראית תקינה");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("blocks an email already registered to a different user", async () => {
    prisma.businessUser.findFirst.mockResolvedValue(ownerMembership("owner@x.com", "usr_owner"));
    prisma.user.findUnique.mockResolvedValue({ id: "usr_other" });
    const res = await adminUpdateOwnerAction(
      BUSINESS_A,
      EMPTY_OWNER,
      fd({ name: "יעל", email: "taken@x.com" }),
    );
    expect(res.fieldErrors?.email).toBe("כתובת האימייל כבר רשומה במערכת");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("skips the uniqueness check when the email is unchanged", async () => {
    prisma.businessUser.findFirst.mockResolvedValue(ownerMembership("owner@x.com"));
    prisma.user.update.mockResolvedValue({});
    const res = await adminUpdateOwnerAction(
      BUSINESS_A,
      EMPTY_OWNER,
      fd({ name: "יעל", email: "Owner@X.com" }),
    );
    expect(res).toEqual({ success: true });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    // updates only the resolved owner, lowercased email, name kept
    const upd = prisma.user.update.mock.calls[0][0] as {
      where: { id: string };
      data: { name: string | null; email: string };
    };
    expect(upd.where).toEqual({ id: "usr_owner" });
    expect(upd.data.email).toBe("owner@x.com");
    expect(upd.data.name).toBe("יעל");
  });

  it("nulls an empty owner name", async () => {
    prisma.businessUser.findFirst.mockResolvedValue(ownerMembership());
    prisma.user.update.mockResolvedValue({});
    await adminUpdateOwnerAction(BUSINESS_A, EMPTY_OWNER, fd({ name: "", email: "owner@x.com" }));
    const upd = prisma.user.update.mock.calls[0][0] as { data: { name: string | null } };
    expect(upd.data.name).toBeNull();
  });

  it("maps a unique-constraint DB error to an email field error", async () => {
    prisma.businessUser.findFirst.mockResolvedValue(ownerMembership("owner@x.com"));
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.update.mockRejectedValue(new Error("Unique constraint failed"));
    const res = await adminUpdateOwnerAction(
      BUSINESS_A,
      EMPTY_OWNER,
      fd({ name: "יעל", email: "new@x.com" }),
    );
    expect(res.fieldErrors?.email).toBe("כתובת האימייל כבר רשומה במערכת");
  });

  it("maps any other DB error to a safe generic formError (no leak)", async () => {
    prisma.businessUser.findFirst.mockResolvedValue(ownerMembership("owner@x.com"));
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.update.mockRejectedValue(new Error("boom secretZZZ"));
    const res = await adminUpdateOwnerAction(
      BUSINESS_A,
      EMPTY_OWNER,
      fd({ name: "יעל", email: "new@x.com" }),
    );
    expect(res).toEqual({ formError: "משהו השתבש. יש לנסות שוב בעוד רגע" });
    expect(JSON.stringify(res)).not.toContain("secretZZZ");
  });
});
