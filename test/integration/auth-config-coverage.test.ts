import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Coverage for the NextAuth config's reachable logic: the Credentials
 * `authorize()` callback and the jwt/session callbacks.
 *
 * `NextAuth()` runs at module load, so we mock `next-auth` and capture the
 * config object it is called with. That lets us invoke authorize/callbacks in
 * isolation without booting NextAuth internals or touching env/network.
 */

// Capture whatever config NextAuth() is called with. `vi.hoisted` ensures the
// container exists before the hoisted vi.mock factory references it.
const captured = vi.hoisted(() => ({ config: undefined as Record<string, unknown> | undefined }));
vi.mock("next-auth", () => ({
  default: (config: Record<string, unknown>) => {
    captured.config = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
}));

// Credentials provider is a passthrough so authorize survives onto the config.
vi.mock("next-auth/providers/credentials", () => ({
  default: (opts: Record<string, unknown>) => ({ id: "credentials", ...opts }),
}));

const findUnique = vi.fn();
vi.mock("@/server/db/prisma", () => ({
  prisma: { user: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));

const verifyPassword = vi.fn();
vi.mock("@/server/auth/password", () => ({
  verifyPassword: (...a: unknown[]) => verifyPassword(...a),
}));

// Import AFTER mocks so NextAuth() is captured.
import "@/server/auth/config";

type AuthorizeFn = (
  c: { email?: string; password?: string } | undefined,
) => Promise<unknown>;

function getAuthorize(): AuthorizeFn {
  const providers = captured.config!.providers as Array<{ authorize: AuthorizeFn }>;
  return providers[0].authorize;
}

function getCallbacks() {
  return captured.config!.callbacks as {
    jwt: (a: { token: Record<string, unknown>; user?: { id?: string } }) => Record<string, unknown>;
    session: (a: {
      session: { user?: { id?: string } };
      token: { id?: unknown };
    }) => { user?: { id?: string } };
  };
}

beforeEach(() => {
  findUnique.mockReset();
  verifyPassword.mockReset();
});

describe("auth/config — module wiring", () => {
  it("configures the JWT session strategy and /login sign-in page", () => {
    expect(captured.config).toBeDefined();
    expect((captured.config!.session as { strategy: string }).strategy).toBe("jwt");
    expect((captured.config!.pages as { signIn: string }).signIn).toBe("/login");
    expect(captured.config!.trustHost).toBe(true);
  });
});

describe("auth/config — credentials authorize()", () => {
  it("returns null when validation fails (missing email/password)", async () => {
    const res = await getAuthorize()({ email: "", password: "" });
    expect(res).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns null and does not reveal that an email is unknown", async () => {
    findUnique.mockResolvedValue(null);
    const res = await getAuthorize()({ email: "ghost@example.com", password: "secret123" });
    expect(res).toBeNull();
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("returns null when the password does not match", async () => {
    findUnique.mockResolvedValue({
      id: "usr_1",
      email: "owner@example.com",
      name: "בעלת העסק",
      passwordHash: "hash",
    });
    verifyPassword.mockResolvedValue(false);
    const res = await getAuthorize()({ email: "owner@example.com", password: "wrongpass" });
    expect(res).toBeNull();
  });

  it("returns only public-safe fields on a valid login (no passwordHash)", async () => {
    findUnique.mockResolvedValue({
      id: "usr_1",
      email: "owner@example.com",
      name: "בעלת העסק",
      passwordHash: "hash",
    });
    verifyPassword.mockResolvedValue(true);
    const res = (await getAuthorize()({
      email: "Owner@Example.com",
      password: "correct-horse",
    })) as Record<string, unknown>;
    expect(res).toEqual({ id: "usr_1", email: "owner@example.com", name: "בעלת העסק" });
    expect(res).not.toHaveProperty("passwordHash");
    // Email is lowercased by validateLogin before the lookup.
    expect(findUnique).toHaveBeenCalledWith({ where: { email: "owner@example.com" } });
  });

  it("coerces missing credentials object to empty strings → null", async () => {
    const res = await getAuthorize()(undefined);
    expect(res).toBeNull();
  });
});

describe("auth/config — jwt & session callbacks", () => {
  it("jwt copies the user id onto the token on sign-in", () => {
    const { jwt } = getCallbacks();
    const token = jwt({ token: {}, user: { id: "usr_9" } });
    expect(token.id).toBe("usr_9");
  });

  it("jwt leaves the token untouched on subsequent calls (no user)", () => {
    const { jwt } = getCallbacks();
    const token = jwt({ token: { id: "existing" } });
    expect(token.id).toBe("existing");
  });

  it("session injects the token id into session.user when present", () => {
    const { session } = getCallbacks();
    const out = session({ session: { user: { id: "" } }, token: { id: "usr_9" } });
    expect(out.user!.id).toBe("usr_9");
  });

  it("session leaves session.user.id alone when token.id is not a string", () => {
    const { session } = getCallbacks();
    const out = session({ session: { user: { id: "keep" } }, token: { id: 123 } });
    expect(out.user!.id).toBe("keep");
  });

  it("session handles a session without a user object", () => {
    const { session } = getCallbacks();
    const out = session({ session: {}, token: { id: "usr_9" } });
    expect(out.user).toBeUndefined();
  });
});
