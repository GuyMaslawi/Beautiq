import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, makeBusiness, makeUser } from "../helpers/factories";

/**
 * Access-control core (CLAUDE.md §9–10). This is the gate every protected route
 * goes through, so the assertions here are deliberately strict:
 *  - unauthenticated → redirect("/login")
 *  - authenticated but no business → redirect("/dashboard")
 *  - getCurrentUser never selects passwordHash
 *  - requireTenant derives businessId from the membership, never from input
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

const auth = vi.fn();
vi.mock("@/server/auth/config", () => ({ auth: () => auth() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

import {
  getCurrentUser,
  requireCurrentUser,
  getCurrentBusiness,
  requireCurrentBusiness,
  requireTenant,
} from "@/server/auth/session";

beforeEach(() => {
  resetPrismaMock(prisma);
  auth.mockReset();
});

function signedInAs(userId: string) {
  auth.mockResolvedValue({ user: { id: userId } });
}

describe("getCurrentUser", () => {
  it("returns null when there is no session", async () => {
    auth.mockResolvedValue(null);
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the session has no user id", async () => {
    auth.mockResolvedValue({ user: {} });
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("looks the user up by id and NEVER selects passwordHash", async () => {
    signedInAs("usr_1");
    prisma.user.findUnique.mockResolvedValue({
      id: "usr_1",
      email: "owner@example.com",
      name: "בעלת העסק",
      isAdmin: false,
    });

    const user = await getCurrentUser();
    expect(user?.id).toBe("usr_1");

    const arg = prisma.user.findUnique.mock.calls[0][0] as {
      where: { id: string };
      select: Record<string, boolean>;
    };
    expect(arg.where).toEqual({ id: "usr_1" });
    // Critical: the select must not expose the password hash.
    expect(arg.select.passwordHash).toBeUndefined();
    expect(arg.select).toEqual({
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      plan: true,
      planActivatedAt: true,
      planExpiresAt: true,
      suspendedUntil: true,
      lastSeenAt: true,
    });
  });
});

describe("requireCurrentUser", () => {
  it("redirects to /login when unauthenticated", async () => {
    auth.mockResolvedValue(null);
    await expect(requireCurrentUser()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("returns the user when authenticated", async () => {
    signedInAs("usr_1");
    prisma.user.findUnique.mockResolvedValue(
      makeUser({ id: "usr_1", isAdmin: false }),
    );
    const user = await requireCurrentUser();
    expect(user.id).toBe("usr_1");
  });
});

describe("getCurrentBusiness", () => {
  it("returns null when unauthenticated", async () => {
    auth.mockResolvedValue(null);
    await expect(getCurrentBusiness()).resolves.toBeNull();
    expect(prisma.businessUser.findFirst).not.toHaveBeenCalled();
  });

  it("resolves the user's first membership scoped by userId", async () => {
    signedInAs("usr_1");
    prisma.user.findUnique.mockResolvedValue(makeUser({ id: "usr_1" }));
    prisma.businessUser.findFirst.mockResolvedValue({
      business: makeBusiness({ id: BUSINESS_A }),
    });

    const biz = await getCurrentBusiness();
    expect(biz?.id).toBe(BUSINESS_A);
    expect(prisma.businessUser.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "usr_1" },
        orderBy: { createdAt: "asc" },
      }),
    );
  });

  it("returns null when the user has no membership", async () => {
    signedInAs("usr_1");
    prisma.user.findUnique.mockResolvedValue(makeUser({ id: "usr_1" }));
    prisma.businessUser.findFirst.mockResolvedValue(null);
    await expect(getCurrentBusiness()).resolves.toBeNull();
  });
});

describe("requireCurrentBusiness", () => {
  it("redirects to /login when unauthenticated", async () => {
    auth.mockResolvedValue(null);
    await expect(requireCurrentBusiness()).rejects.toThrow(
      "NEXT_REDIRECT:/login",
    );
  });

  it("redirects to /dashboard when the user has no business", async () => {
    signedInAs("usr_1");
    prisma.user.findUnique.mockResolvedValue(makeUser({ id: "usr_1" }));
    prisma.businessUser.findFirst.mockResolvedValue(null);
    await expect(requireCurrentBusiness()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
  });

  it("returns the business when one exists", async () => {
    signedInAs("usr_1");
    prisma.user.findUnique.mockResolvedValue(makeUser({ id: "usr_1" }));
    prisma.businessUser.findFirst.mockResolvedValue({
      business: makeBusiness({ id: BUSINESS_A }),
    });
    const biz = await requireCurrentBusiness();
    expect(biz.id).toBe(BUSINESS_A);
  });

  // The plan/suspension gate must live HERE, not only in the (app) layout:
  // Server Actions are directly POSTable and never render the layout, so a
  // layout-only guard let an unpaid or admin-suspended account keep writing data
  // and sending Allura-billed WhatsApp messages.
  it("redirects an unpaid account to /subscribe (Server Action paywall)", async () => {
    signedInAs("usr_1");
    prisma.user.findUnique.mockResolvedValue(
      makeUser({ id: "usr_1", plan: null }),
    );
    await expect(requireCurrentBusiness()).rejects.toThrow(
      "NEXT_REDIRECT:/subscribe",
    );
    // Never even resolves a tenant for an unpaid caller.
    expect(prisma.businessUser.findFirst).not.toHaveBeenCalled();
  });

  it("redirects a suspended account to /suspended", async () => {
    signedInAs("usr_1");
    prisma.user.findUnique.mockResolvedValue(
      makeUser({
        id: "usr_1",
        suspendedUntil: new Date(Date.now() + 86_400_000),
      }),
    );
    await expect(requireCurrentBusiness()).rejects.toThrow(
      "NEXT_REDIRECT:/suspended",
    );
  });
});

describe("requireTenant", () => {
  it("derives the businessId from the authenticated membership", async () => {
    signedInAs("usr_1");
    prisma.user.findUnique.mockResolvedValue(makeUser({ id: "usr_1" }));
    prisma.businessUser.findFirst.mockResolvedValue({
      business: makeBusiness({ id: BUSINESS_A }),
    });
    const tenant = await requireTenant();
    expect(tenant).toEqual({ businessId: BUSINESS_A });
  });

  it("redirects (never returns a tenant) when unauthenticated", async () => {
    auth.mockResolvedValue(null);
    await expect(requireTenant()).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});
