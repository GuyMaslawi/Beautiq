import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

/**
 * Password hashing. Uses the real bcryptjs implementation (a little slow, but
 * the security property — hash != plaintext, verify works — is what matters).
 */

describe("hashPassword / verifyPassword", () => {
  it("produces a bcrypt hash that is NOT the plaintext", async () => {
    const hash = await hashPassword("supersecret1");
    expect(hash).not.toBe("supersecret1");
    expect(hash).not.toContain("supersecret1");
    // bcrypt hashes start with $2a$ / $2b$ and are 60 chars long.
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash.length).toBe(60);
  });

  it("verifies the correct password", async () => {
    const hash = await hashPassword("supersecret1");
    await expect(verifyPassword("supersecret1", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("supersecret1");
    await expect(verifyPassword("wrongpassword", hash)).resolves.toBe(false);
  });

  it("produces different hashes for the same password (random salt)", async () => {
    const a = await hashPassword("samepassword");
    const b = await hashPassword("samepassword");
    expect(a).not.toBe(b);
    // ...yet both still verify.
    await expect(verifyPassword("samepassword", a)).resolves.toBe(true);
    await expect(verifyPassword("samepassword", b)).resolves.toBe(true);
  });
});
