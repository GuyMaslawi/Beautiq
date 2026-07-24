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

// Google provider passthrough so it registers without env/network.
vi.mock("next-auth/providers/google", () => ({
  default: (opts: Record<string, unknown>) => ({ id: "google", ...opts }),
}));

const findUnique = vi.fn();
const create = vi.fn();
const update = vi.fn();
const activityCreate = vi.fn();
vi.mock("@/server/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      create: (...a: unknown[]) => create(...a),
      update: (...a: unknown[]) => update(...a),
    },
    activityLog: { create: (...a: unknown[]) => activityCreate(...a) },
  },
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
    signIn: (a: {
      account?: { provider?: string } | null;
      profile?: { email?: string; email_verified?: boolean };
    }) => boolean;
    jwt: (a: {
      token: Record<string, unknown>;
      user?: { id?: string };
      account?: { provider?: string } | null;
      profile?: { email?: string; name?: string; email_verified?: boolean };
    }) => Promise<Record<string, unknown>>;
    session: (a: {
      session: { user?: { id?: string } };
      token: { id?: unknown };
    }) => { user?: { id?: string } };
  };
}

beforeEach(() => {
  findUnique.mockReset();
  verifyPassword.mockReset();
  create.mockReset();
  update.mockReset();
  activityCreate.mockReset();
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

  it("returns null for a Google-only account (no passwordHash) — password login rejected", async () => {
    findUnique.mockResolvedValue({
      id: "usr_g",
      email: "google@example.com",
      name: "משתמשת גוגל",
      passwordHash: null,
    });
    const res = await getAuthorize()({ email: "google@example.com", password: "whatever1" });
    expect(res).toBeNull();
    expect(verifyPassword).not.toHaveBeenCalled();
  });
});

describe("auth/config — Google (social) sign-in", () => {
  it("signIn allows Google only with a verified email", () => {
    const { signIn } = getCallbacks();
    const google = { provider: "google" };
    expect(signIn({ account: google, profile: { email: "a@b.com", email_verified: true } })).toBe(true);
    // Undefined email_verified is tolerated (email present) — Google omits it for some accounts.
    expect(signIn({ account: google, profile: { email: "a@b.com" } })).toBe(true);
    expect(signIn({ account: google, profile: { email: "a@b.com", email_verified: false } })).toBe(false);
    expect(signIn({ account: google, profile: {} })).toBe(false);
  });

  it("signIn passes through non-Google providers unchanged", () => {
    const { signIn } = getCallbacks();
    expect(signIn({ account: { provider: "credentials" } })).toBe(true);
  });

  it("jwt creates our User row for a new Google identity and stores OUR id", async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ id: "usr_new", email: "new@example.com", isAdmin: false });
    update.mockResolvedValue({});
    activityCreate.mockResolvedValue({});
    const { jwt } = getCallbacks();
    const token = await jwt({
      token: {},
      account: { provider: "google" },
      profile: { email: "New@Example.com", name: "לקוחה חדשה", email_verified: true },
    });
    expect(token.id).toBe("usr_new");
    // Email is normalised (trim + lowercase) before lookup/creation.
    expect(findUnique).toHaveBeenCalledWith({ where: { email: "new@example.com" } });
    expect(create).toHaveBeenCalledWith({
      data: { email: "new@example.com", name: "לקוחה חדשה" },
    });
  });

  it("jwt links an existing account by email without creating a new row", async () => {
    findUnique.mockResolvedValue({ id: "usr_existing", email: "owner@example.com", isAdmin: false });
    update.mockResolvedValue({});
    activityCreate.mockResolvedValue({});
    const { jwt } = getCallbacks();
    const token = await jwt({
      token: {},
      account: { provider: "google" },
      profile: { email: "owner@example.com", email_verified: true },
    });
    expect(token.id).toBe("usr_existing");
    expect(create).not.toHaveBeenCalled();
  });

  it("jwt keeps the token id even if best-effort telemetry throws", async () => {
    findUnique.mockResolvedValue({ id: "usr_x", email: "x@example.com", isAdmin: false });
    activityCreate.mockRejectedValue(new Error("db down"));
    const { jwt } = getCallbacks();
    const token = await jwt({
      token: {},
      account: { provider: "google" },
      profile: { email: "x@example.com", email_verified: true },
    });
    expect(token.id).toBe("usr_x");
  });
});

describe("auth/config — jwt & session callbacks", () => {
  it("jwt copies the user id onto the token on sign-in", async () => {
    const { jwt } = getCallbacks();
    const token = await jwt({ token: {}, user: { id: "usr_9" } });
    expect(token.id).toBe("usr_9");
  });

  it("jwt leaves the token untouched on subsequent calls (no user)", async () => {
    const { jwt } = getCallbacks();
    const token = await jwt({ token: { id: "existing" } });
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
