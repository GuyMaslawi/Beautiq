import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Platform-admin gate (CLAUDE.md §16). Non-admin users must be blocked from
 * admin-only routes. We mock getCurrentUser (the source of the isAdmin flag) and
 * assert the gate redirects unless the user is a platform admin.
 */

const getCurrentUser = vi.fn();
vi.mock("@/server/auth/session", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

import { isPlatformAdmin, requirePlatformAdmin } from "@/server/admin/auth";

beforeEach(() => {
  getCurrentUser.mockReset();
});

describe("isPlatformAdmin", () => {
  it("is false when unauthenticated", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(isPlatformAdmin()).resolves.toBe(false);
  });

  it("is false for a regular (non-admin) user", async () => {
    getCurrentUser.mockResolvedValue({ id: "usr_1", isAdmin: false });
    await expect(isPlatformAdmin()).resolves.toBe(false);
  });

  it("is true for a platform admin", async () => {
    getCurrentUser.mockResolvedValue({ id: "usr_1", isAdmin: true });
    await expect(isPlatformAdmin()).resolves.toBe(true);
  });
});

describe("requirePlatformAdmin", () => {
  it("redirects to /dashboard for an unauthenticated visitor", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(requirePlatformAdmin()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
  });

  it("redirects to /dashboard for a non-admin user (blocks access)", async () => {
    getCurrentUser.mockResolvedValue({ id: "usr_1", isAdmin: false });
    await expect(requirePlatformAdmin()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
  });

  it("allows a platform admin through (no redirect)", async () => {
    getCurrentUser.mockResolvedValue({ id: "usr_1", isAdmin: true });
    await expect(requirePlatformAdmin()).resolves.toBeUndefined();
  });
});
