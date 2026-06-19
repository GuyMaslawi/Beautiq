import { describe, it, expect, afterEach, vi } from "vitest";
import { checkEnv } from "@/lib/env";

// checkEnv קורא ישירות מ-process.env. משתמשים ב-vi.stubEnv כדי לקבוע סביבה
// נקייה לכל בדיקה, ו-vi.unstubAllEnvs משחזר את המקור בסוף.
function setEnv(vars: Record<string, string>) {
  // מתחילים מסביבה נקייה: מנטרלים כל משתנה שהבדיקות נוגעות בו.
  for (const k of [
    "DATABASE_URL",
    "AUTH_SECRET",
    "CRON_SECRET",
    "NEXT_PUBLIC_APP_URL",
    "ENABLE_REAL_WHATSAPP_SEND",
    "META_WHATSAPP_ACCESS_TOKEN",
    "META_WHATSAPP_PHONE_NUMBER_ID",
    "META_WEBHOOK_APP_SECRET",
    "META_WEBHOOK_VERIFY_TOKEN",
    "WHATSAPP_USE_ENV_FALLBACK",
    "WHATSAPP_CREDENTIALS_ENCRYPTION_KEY",
    "WHATSAPP_TEST_MODE",
    "PAYMENTS_ENABLED",
    "PAYMENT_PROVIDER",
    "PAYMENT_WEBHOOK_SECRET",
    "PAYMENTS_CREDENTIALS_ENCRYPTION_KEY",
  ]) {
    vi.stubEnv(k, "");
  }
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("checkEnv", () => {
  it("flags missing always-required vars (DATABASE_URL, AUTH_SECRET)", () => {
    setEnv({ NODE_ENV: "production", CRON_SECRET: "x" });
    const { errors } = checkEnv();
    expect(errors.some((e) => e.includes("DATABASE_URL"))).toBe(true);
    expect(errors.some((e) => e.includes("AUTH_SECRET"))).toBe(true);
  });

  it("requires CRON_SECRET only in production", () => {
    setEnv({ NODE_ENV: "development", DATABASE_URL: "postgres://x", AUTH_SECRET: "s" });
    expect(checkEnv().errors.some((e) => e.includes("CRON_SECRET"))).toBe(false);

    setEnv({ NODE_ENV: "production", DATABASE_URL: "postgres://x", AUTH_SECRET: "s" });
    expect(checkEnv().errors.some((e) => e.includes("CRON_SECRET"))).toBe(true);
  });

  it("passes cleanly with a complete minimal production config", () => {
    setEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://x",
      AUTH_SECRET: "s",
      CRON_SECRET: "c",
      NEXT_PUBLIC_APP_URL: "https://allura.info",
    });
    expect(checkEnv().errors).toEqual([]);
  });

  it("requires Meta credentials only when real WhatsApp send is on", () => {
    setEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://x",
      AUTH_SECRET: "s",
      CRON_SECRET: "c",
      ENABLE_REAL_WHATSAPP_SEND: "true",
    });
    const errors = checkEnv().errors;
    expect(errors.some((e) => e.includes("META_WHATSAPP_ACCESS_TOKEN"))).toBe(true);
    expect(errors.some((e) => e.includes("META_WEBHOOK_APP_SECRET"))).toBe(true);
  });

  it("requires payment secrets only for a real provider when payments are enabled", () => {
    // mock provider — no payment secrets required even when enabled
    setEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://x",
      AUTH_SECRET: "s",
      CRON_SECRET: "c",
      PAYMENTS_ENABLED: "true",
      PAYMENT_PROVIDER: "mock",
    });
    expect(checkEnv().errors.some((e) => e.includes("PAYMENT_WEBHOOK_SECRET"))).toBe(false);

    // real provider — secrets become mandatory
    setEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://x",
      AUTH_SECRET: "s",
      CRON_SECRET: "c",
      PAYMENTS_ENABLED: "true",
      PAYMENT_PROVIDER: "payplus",
    });
    const errors = checkEnv().errors;
    expect(errors.some((e) => e.includes("PAYMENT_WEBHOOK_SECRET"))).toBe(true);
    expect(errors.some((e) => e.includes("PAYMENTS_CREDENTIALS_ENCRYPTION_KEY"))).toBe(true);
  });

  it("warns (not errors) about WHATSAPP_TEST_MODE in production", () => {
    setEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://x",
      AUTH_SECRET: "s",
      CRON_SECRET: "c",
      WHATSAPP_TEST_MODE: "true",
    });
    const { errors, warnings } = checkEnv();
    expect(errors.some((e) => e.includes("WHATSAPP_TEST_MODE"))).toBe(false);
    expect(warnings.some((w) => w.includes("WHATSAPP_TEST_MODE"))).toBe(true);
  });
});
