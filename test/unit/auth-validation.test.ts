import { describe, it, expect } from "vitest";
import {
  validateSignup,
  validateLogin,
  PASSWORD_MIN_LENGTH,
} from "@/lib/validation/auth";
import { AUTH } from "@/lib/constants/he";

/**
 * Pure validator tests for the auth forms. These are the server-side source of
 * truth (CLAUDE.md §17) and never touch the DB.
 */

describe("validateSignup", () => {
  const valid = {
    name: "דנה",
    email: "Owner@Example.com",
    password: "supersecret1",
    confirmPassword: "supersecret1",
  };

  it("accepts a fully valid signup and normalizes name/email", () => {
    const r = validateSignup({ ...valid, name: "  דנה  " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe("דנה");
      // email lowercased + trimmed
      expect(r.value.email).toBe("owner@example.com");
      // password is NOT trimmed/altered
      expect(r.value.password).toBe("supersecret1");
    }
  });

  it("requires a name", () => {
    const r = validateSignup({ ...valid, name: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.name).toBe(AUTH.errors.nameRequired);
  });

  it("requires an email", () => {
    const r = validateSignup({ ...valid, email: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.email).toBe(AUTH.errors.emailRequired);
  });

  it("rejects a malformed email", () => {
    for (const bad of ["not-an-email", "a@b", "a b@c.com", "@x.com", "x@.com"]) {
      const r = validateSignup({ ...valid, email: bad });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.email).toBe(AUTH.errors.invalidEmail);
    }
  });

  it("requires a password", () => {
    const r = validateSignup({ ...valid, password: "", confirmPassword: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.password).toBe(AUTH.errors.passwordRequired);
  });

  it("rejects a password shorter than the minimum length", () => {
    const short = "a".repeat(PASSWORD_MIN_LENGTH - 1);
    const r = validateSignup({ ...valid, password: short, confirmPassword: short });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.password).toBe(AUTH.errors.passwordTooShort);
  });

  it("accepts a password exactly at the minimum length", () => {
    const exact = "a".repeat(PASSWORD_MIN_LENGTH);
    const r = validateSignup({
      ...valid,
      password: exact,
      confirmPassword: exact,
    });
    expect(r.ok).toBe(true);
  });

  it("requires password confirmation", () => {
    const r = validateSignup({ ...valid, confirmPassword: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.confirmPassword).toBe(AUTH.errors.confirmRequired);
  });

  it("rejects mismatched passwords", () => {
    const r = validateSignup({ ...valid, confirmPassword: "different1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.confirmPassword).toBe(AUTH.errors.passwordsMismatch);
  });

  it("collects multiple field errors at once", () => {
    const r = validateSignup({
      name: "",
      email: "bad",
      password: "x",
      confirmPassword: "y",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.name).toBeTruthy();
      expect(r.errors.email).toBeTruthy();
      expect(r.errors.password).toBeTruthy();
    }
  });
});

describe("validateLogin", () => {
  it("accepts valid credentials and normalizes email", () => {
    const r = validateLogin({ email: "  Owner@Example.com ", password: "pw" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.email).toBe("owner@example.com");
      expect(r.value.password).toBe("pw");
    }
  });

  it("returns a GENERIC error (does not reveal whether the email exists)", () => {
    const r = validateLogin({ email: "", password: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // Deliberately generic per CLAUDE.md §13 — same message for missing email
      // or missing password, never "no such user".
      expect(r.errors.form).toBe(AUTH.errors.required);
    }
  });

  it("rejects a missing password even with an email", () => {
    const r = validateLogin({ email: "owner@example.com", password: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.form).toBe(AUTH.errors.required);
  });

  it("does not validate email format on login (kept generic)", () => {
    // A malformed email + a password still passes the shape check — login
    // intentionally avoids leaking format-level detail; the credentials check
    // happens at sign-in.
    const r = validateLogin({ email: "garbage", password: "pw" });
    expect(r.ok).toBe(true);
  });
});
