import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * The impersonation cookie lets a platform admin view the app as a business
 * owner. It is HMAC-signed with AUTH_SECRET, and getCurrentUser() additionally
 * re-verifies on every request that the live session user really is an admin —
 * so a non-admin cannot self-elevate by crafting one.
 *
 * What is tested here is the token's LIFETIME. The 2-hour window used to be
 * enforced only by the browser cookie's maxAge, which is a client-side hint: a
 * copied cookie value stayed a valid bearer credential indefinitely, letting an
 * admin (or anyone who obtained the value) silently re-enter a tenant later with
 * no admin.impersonate_start entry in the audit log.
 */
const ORIGINAL_SECRET = process.env.AUTH_SECRET;

beforeEach(() => {
  vi.resetModules();
  process.env.AUTH_SECRET = "test-auth-secret-value";
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = ORIGINAL_SECRET;
});

async function mod() {
  return import("@/server/admin/impersonation");
}

function payload(startedAt: number) {
  return {
    adminId: "admin_1",
    targetUserId: "usr_1",
    businessId: "biz_1",
    startedAt,
  };
}

describe("impersonation cookie — signing", () => {
  it("round-trips a freshly issued token", async () => {
    const { encodeImpersonation, decodeImpersonation } = await mod();
    const p = payload(Date.now());
    const decoded = decodeImpersonation(encodeImpersonation(p));
    expect(decoded).toMatchObject({
      adminId: "admin_1",
      targetUserId: "usr_1",
      businessId: "biz_1",
    });
  });

  it("rejects a tampered payload (signature mismatch)", async () => {
    const { encodeImpersonation, decodeImpersonation } = await mod();
    const token = encodeImpersonation(payload(Date.now()));
    const [body, sig] = token.split(".");
    // Swap the target user for someone else, keeping the original signature.
    const forgedBody = Buffer.from(
      JSON.stringify({ ...payload(Date.now()), targetUserId: "victim" }),
    ).toString("base64url");
    expect(decodeImpersonation(`${forgedBody}.${sig}`)).toBeNull();
    expect(decodeImpersonation(`${body}.deadbeef`)).toBeNull();
  });

  it("rejects a malformed token", async () => {
    const { decodeImpersonation } = await mod();
    expect(decodeImpersonation("")).toBeNull();
    expect(decodeImpersonation("no-dot")).toBeNull();
    expect(decodeImpersonation(".onlysig")).toBeNull();
  });

  // Fail closed: with no AUTH_SECRET there is no safe key, so signing must throw
  // rather than fall back to a hardcoded string that would make every cookie
  // forgeable by anyone who read the source.
  it("refuses to sign when AUTH_SECRET is absent", async () => {
    delete process.env.AUTH_SECRET;
    const { encodeImpersonation } = await mod();
    expect(() => encodeImpersonation(payload(Date.now()))).toThrow(/AUTH_SECRET/);
  });
});

describe("impersonation cookie — server-side expiry", () => {
  it("rejects a token older than the 2-hour window", async () => {
    const { encodeImpersonation, decodeImpersonation, IMPERSONATION_MAX_AGE } =
      await mod();
    const stale = Date.now() - (IMPERSONATION_MAX_AGE * 1000 + 60_000);
    expect(decodeImpersonation(encodeImpersonation(payload(stale)))).toBeNull();
  });

  it("still accepts a token inside the window", async () => {
    const { encodeImpersonation, decodeImpersonation, IMPERSONATION_MAX_AGE } =
      await mod();
    const recent = Date.now() - (IMPERSONATION_MAX_AGE * 1000) / 2;
    expect(decodeImpersonation(encodeImpersonation(payload(recent)))).not.toBeNull();
  });

  // A crafted future startedAt must not buy extra lifetime.
  it("rejects a future-dated token", async () => {
    const { encodeImpersonation, decodeImpersonation } = await mod();
    const future = Date.now() + 10 * 60_000;
    expect(decodeImpersonation(encodeImpersonation(payload(future)))).toBeNull();
  });

  it("rejects a token with a missing or non-numeric startedAt", async () => {
    const { encodeImpersonation, decodeImpersonation } = await mod();
    const bad = encodeImpersonation({
      ...payload(Date.now()),
      startedAt: "recently" as unknown as number,
    });
    expect(decodeImpersonation(bad)).toBeNull();
  });
});
