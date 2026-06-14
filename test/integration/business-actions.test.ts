import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, makeBusiness, makeUser } from "../helpers/factories";
import { ONBOARDING } from "@/lib/constants/he";

/**
 * Business creation. The owner is derived from the authenticated session
 * (CLAUDE.md §10), never from input; the slug is generated server-side and must
 * be unique. Asserts the membership is created under the authenticated user.
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

const requireCurrentUser = vi.fn();
const getCurrentBusiness = vi.fn();
vi.mock("@/server/auth/session", () => ({
  requireCurrentUser: (...a: unknown[]) => requireCurrentUser(...a),
  getCurrentBusiness: (...a: unknown[]) => getCurrentBusiness(...a),
}));

import { createBusinessAction } from "@/server/business/actions";

beforeEach(() => {
  resetPrismaMock(prisma);
  requireCurrentUser.mockReset().mockResolvedValue(makeUser({ id: "usr_1" }));
  getCurrentBusiness.mockReset().mockResolvedValue(null);
});

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("createBusinessAction", () => {
  it("creates the business with the owner derived from the session", async () => {
    prisma.business.findUnique.mockResolvedValue(null); // slug is free
    prisma.business.create.mockResolvedValue(makeBusiness());

    const res = await createBusinessAction({}, fd({ name: "Studio Glow" }));
    expect(res.created).toBe(true);

    const arg = prisma.business.create.mock.calls[0][0] as {
      data: {
        name: string;
        slug: string;
        members: { create: { userId: string; role: string } };
      };
    };
    expect(arg.data.name).toBe("Studio Glow");
    // Owner is the authenticated user, role owner.
    expect(arg.data.members.create.userId).toBe("usr_1");
    expect(arg.data.members.create.role).toBe("owner");
    // A slug was generated server-side.
    expect(typeof arg.data.slug).toBe("string");
    expect(arg.data.slug.length).toBeGreaterThan(0);
  });

  it("signals success without creating a second business (V1 = one per user)", async () => {
    getCurrentBusiness.mockResolvedValue(makeBusiness({ id: BUSINESS_A }));
    const res = await createBusinessAction({}, fd({ name: "Another" }));
    expect(res.created).toBe(true);
    expect(prisma.business.create).not.toHaveBeenCalled();
  });

  it("rejects a missing name without writing", async () => {
    const res = await createBusinessAction({}, fd({ name: "  " }));
    expect(res.errors?.name).toBe(ONBOARDING.errors.nameRequired);
    expect(prisma.business.create).not.toHaveBeenCalled();
  });

  it("appends a suffix when the generated slug is already taken", async () => {
    // First slug candidate exists, second is free.
    prisma.business.findUnique
      .mockResolvedValueOnce({ id: "other" })
      .mockResolvedValueOnce(null);
    prisma.business.create.mockResolvedValue(makeBusiness());

    await createBusinessAction({}, fd({ name: "Studio Glow" }));
    const arg = prisma.business.create.mock.calls[0][0] as {
      data: { slug: string };
    };
    expect(arg.data.slug).toMatch(/-1$/);
  });

  it("returns a safe generic error on a unique-constraint (P2002) race", async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    prisma.business.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "x",
      }),
    );
    const res = await createBusinessAction({}, fd({ name: "Studio Glow" }));
    expect(res.formError).toBe(ONBOARDING.errors.generic);
  });

  it("returns a safe generic error (no secret) on an unexpected DB failure", async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    prisma.business.create.mockRejectedValue(new Error("secret db error"));
    const res = await createBusinessAction({}, fd({ name: "Studio Glow" }));
    expect(res.formError).toBe(ONBOARDING.errors.generic);
    expect(res.formError).not.toContain("secret");
  });
});
