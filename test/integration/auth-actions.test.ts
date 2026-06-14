import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { AUTH } from "@/lib/constants/he";

/**
 * Signup / login server actions. Asserts that:
 *  - invalid input is rejected BEFORE any DB write
 *  - duplicate-email is surfaced safely (no leak of internal state)
 *  - login errors stay generic (never reveal whether the email exists)
 *  - the stored password is hashed, never the plaintext
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

const signIn = vi.fn();
const signOut = vi.fn();
vi.mock("@/server/auth/config", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
  signOut: (...args: unknown[]) => signOut(...args),
}));

// Avoid the slow real bcrypt in action tests — hashing itself is covered by the
// password unit test.
vi.mock("@/server/auth/password", () => ({
  hashPassword: vi.fn(async (plain: string) => `hashed:${plain}`),
}));

// next-auth pulls in "next/server" which doesn't resolve cleanly in the node
// test env. The action only needs `AuthError` for an `instanceof` check, so we
// stub it with a minimal class (defined inside the hoisted factory).
vi.mock("next-auth", () => {
  class StubAuthError extends Error {}
  return { AuthError: StubAuthError };
});

import {
  signupAction,
  loginAction,
  signOutAction,
} from "@/server/auth/actions";
import { Prisma } from "@prisma/client";
import { AuthError as StubAuthError } from "next-auth";

beforeEach(() => {
  resetPrismaMock(prisma);
  signIn.mockReset();
  signOut.mockReset();
});

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const validSignup = {
  name: "דנה",
  email: "owner@example.com",
  password: "supersecret1",
  confirmPassword: "supersecret1",
};

describe("signupAction", () => {
  it("returns field errors and does NOT hit the DB when input is invalid", async () => {
    const res = await signupAction({}, fd({ ...validSignup, email: "bad" }));
    expect(res.errors?.email).toBeTruthy();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate email (existing user) without creating", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "usr_1" });
    const res = await signupAction({}, fd(validSignup));
    expect(res.errors?.email).toBe(AUTH.errors.emailTaken);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("creates the user with a HASHED password (never plaintext) then signs in", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "usr_1" });
    signIn.mockResolvedValue(undefined);

    await signupAction({}, fd(validSignup));

    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    const arg = prisma.user.create.mock.calls[0][0] as {
      data: { passwordHash: string; email: string };
    };
    expect(arg.data.passwordHash).toBe("hashed:supersecret1");
    // The plaintext is never persisted.
    expect(JSON.stringify(arg.data)).not.toContain('"supersecret1"');
    expect(signIn).toHaveBeenCalledWith(
      "credentials",
      expect.objectContaining({ email: "owner@example.com", redirectTo: "/dashboard" }),
    );
  });

  it("maps a P2002 unique-constraint race to the safe emailTaken error", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "x",
      }),
    );
    const res = await signupAction({}, fd(validSignup));
    expect(res.errors?.email).toBe(AUTH.errors.emailTaken);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("returns a safe generic error (no secret) on an unexpected DB failure", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockRejectedValue(
      new Error("connection string with secret leaked"),
    );
    const res = await signupAction({}, fd(validSignup));
    expect(res.formError).toBe(AUTH.errors.generic);
    expect(res.formError).not.toContain("secret");
  });

  it("propagates the NEXT_REDIRECT thrown by signIn on success", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "usr_1" });
    signIn.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(signupAction({}, fd(validSignup))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
  });
});

describe("loginAction", () => {
  it("rejects empty credentials with a generic error before sign-in", async () => {
    const res = await loginAction({}, fd({ email: "", password: "" }));
    expect(res.formError).toBe(AUTH.errors.required);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("surfaces a generic invalid-credentials message on AuthError (no email-exists leak)", async () => {
    signIn.mockRejectedValue(new StubAuthError("CredentialsSignin"));

    const res = await loginAction(
      {},
      fd({ email: "owner@example.com", password: "wrong" }),
    );
    expect(res.formError).toBe(AUTH.errors.invalidCredentials);
    // The message must not reveal whether the account exists.
    expect(res.formError).not.toContain("@example.com");
  });

  it("re-throws a non-AuthError (the success redirect) so it propagates", async () => {
    signIn.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(
      loginAction({}, fd({ email: "owner@example.com", password: "pw" })),
    ).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("signOutAction", () => {
  it("calls signOut redirecting to /login", async () => {
    signOut.mockResolvedValue(undefined);
    await signOutAction();
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/login" });
  });
});
