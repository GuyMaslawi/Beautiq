import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BUSINESS_A, makeWhatsAppConnection } from "../helpers/factories";

/**
 * SECURITY-CRITICAL: resolver.ts is the single gate that decides whether a real
 * WhatsApp send can happen. These tests prove:
 *   - No real provider is ever returned unless ENABLE_REAL_WHATSAPP_SEND=true.
 *   - Per-business credentials, env fallback, and Mode B decryption behave per spec.
 *   - Access tokens are NEVER returned to callers or written to logs.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof import("../helpers/prisma-mock").createPrismaMock>;

import { resetPrismaMock } from "../helpers/prisma-mock";
import {
  resolveWhatsAppConnectionForBusiness,
  getWhatsAppProviderForBusiness,
  getWhatsAppDiagnostic,
  getDecryptedCredentialsForBusiness,
  getWhatsAppReadiness,
} from "@/server/whatsapp/resolver";
import { encryptToken } from "@/lib/whatsapp/crypto";

const REAL_TOKEN = "EAAsuper-secret-access-token-value-123456";
const ENCRYPTION_KEY = "a".repeat(64);

// Spy console so we can assert no secret ever appears in any log line.
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetPrismaMock(prisma);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errSpy.mockRestore();
  warnSpy.mockRestore();
});

/** Collect every string passed to any console method this test. */
function allLoggedText(): string {
  const calls = [...logSpy.mock.calls, ...errSpy.mock.calls, ...warnSpy.mock.calls];
  return calls.map((c) => c.map((x) => String(x)).join(" ")).join("\n");
}

function assertNoTokenLeak(): void {
  expect(allLoggedText()).not.toContain(REAL_TOKEN);
}

describe("resolveWhatsAppConnectionForBusiness — global kill switch", () => {
  it("returns disconnected dev_mock provider when ENABLE_REAL_WHATSAPP_SEND is unset", async () => {
    // No env set by default (setup.ts deletes it).
    const resolved = await resolveWhatsAppConnectionForBusiness(BUSINESS_A);

    expect(resolved.mode).toBe("disconnected");
    expect(resolved.provider.name).toBe("dev_mock");
    expect(resolved.isEnvFallback).toBe(false);
    // CRITICAL: the DB must not even be queried — short-circuit before any lookup.
    expect(prisma.whatsAppConnection.findUnique).not.toHaveBeenCalled();
  });

  it("dev_mock provider's send() never reports success (no real send)", async () => {
    const provider = await getWhatsAppProviderForBusiness(BUSINESS_A);
    const res = await provider.send({
      businessId: BUSINESS_A,
      toPhone: "+972500000000",
      fallbackText: "hi",
      automationRunId: "run_1",
      clientId: "cli_1",
    });
    expect(res.success).toBe(false);
    expect(res.isMockSkip).toBe(true);
    expect(res.providerMessageId).toBeNull();
  });

  it("propagates isTestMode flag even in disconnected mode", async () => {
    process.env.WHATSAPP_TEST_MODE = "true";
    const resolved = await resolveWhatsAppConnectionForBusiness(BUSINESS_A);
    expect(resolved.mode).toBe("disconnected");
    expect(resolved.isTestMode).toBe(true);
  });
});

describe("resolveWhatsAppConnectionForBusiness — Mode A (env fallback token)", () => {
  beforeEach(() => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    process.env.META_WHATSAPP_ACCESS_TOKEN = REAL_TOKEN;
  });

  it("active connection + useEnvFallback=true uses env token + DB phoneNumberId", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ useEnvFallback: true, phoneNumberId: "db_phone_555" }),
    );

    const resolved = await resolveWhatsAppConnectionForBusiness(BUSINESS_A);

    expect(resolved.mode).toBe("per_business");
    expect(resolved.provider.name).toBe("meta_cloud_api");
    expect(resolved.phoneNumberId).toBe("db_phone_555");
    assertNoTokenLeak();
  });

  it("disabled provider when env token is missing for a Mode A connection", async () => {
    delete process.env.META_WHATSAPP_ACCESS_TOKEN;
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ useEnvFallback: true }),
    );

    const resolved = await resolveWhatsAppConnectionForBusiness(BUSINESS_A);

    expect(resolved.mode).toBe("per_business");
    expect(resolved.provider.name).toBe("disabled");
    const send = await resolved.provider.send({
      businessId: BUSINESS_A,
      toPhone: "+972500000000",
      fallbackText: "x",
      automationRunId: "r",
      clientId: "c",
    });
    expect(send.success).toBe(false);
    expect(resolved.uiStatus).toContain("חסר");
  });

  it("isEnvFallback is true ONLY when WHATSAPP_USE_ENV_FALLBACK=true", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ useEnvFallback: true }),
    );

    // Without the system-level flag, isEnvFallback must be false even though
    // the connection row says useEnvFallback=true.
    let resolved = await resolveWhatsAppConnectionForBusiness(BUSINESS_A);
    expect(resolved.isEnvFallback).toBe(false);

    process.env.WHATSAPP_USE_ENV_FALLBACK = "true";
    resolved = await resolveWhatsAppConnectionForBusiness(BUSINESS_A);
    expect(resolved.isEnvFallback).toBe(true);
  });

  it("test_mode wraps the provider when WHATSAPP_TEST_MODE=true", async () => {
    process.env.WHATSAPP_TEST_MODE = "true";
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ useEnvFallback: true }),
    );

    const resolved = await resolveWhatsAppConnectionForBusiness(BUSINESS_A);
    expect(resolved.isTestMode).toBe(true);
    expect(resolved.provider.name).toContain("test_mode");
  });
});

describe("resolveWhatsAppConnectionForBusiness — Mode B (encrypted token)", () => {
  beforeEach(() => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = ENCRYPTION_KEY;
  });

  it("decrypts accessTokenEncrypted and returns a real provider", async () => {
    const encrypted = encryptToken(REAL_TOKEN);
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({
        useEnvFallback: false,
        accessTokenEncrypted: encrypted,
        phoneNumberId: "phone_b",
      }),
    );

    const resolved = await resolveWhatsAppConnectionForBusiness(BUSINESS_A);

    expect(resolved.mode).toBe("per_business");
    expect(resolved.provider.name).toBe("meta_cloud_api");
    expect(resolved.phoneNumberId).toBe("phone_b");
    // The encrypted blob and plaintext token must never leak into config either.
    expect(JSON.stringify({ ...resolved, provider: resolved.provider.name })).not.toContain(
      REAL_TOKEN,
    );
    assertNoTokenLeak();
  });

  it("decrypt failure -> disabled provider with safe Hebrew reason, no token leak", async () => {
    // A token encrypted under a DIFFERENT key will fail to decrypt with the test key.
    process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = "b".repeat(64);
    const encryptedUnderOtherKey = encryptToken(REAL_TOKEN);
    process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = ENCRYPTION_KEY;

    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({
        useEnvFallback: false,
        accessTokenEncrypted: encryptedUnderOtherKey,
        phoneNumberId: "phone_b",
      }),
    );

    const resolved = await resolveWhatsAppConnectionForBusiness(BUSINESS_A);

    expect(resolved.provider.name).toBe("disabled");
    expect(resolved.uiDetail).toContain("פענוח");
    // No plaintext or ciphertext token in logs.
    expect(allLoggedText()).not.toContain(REAL_TOKEN);
    expect(allLoggedText()).not.toContain(encryptedUnderOtherKey);
  });

  it("missing encrypted token (Mode B) -> disabled, never falls through to env token", async () => {
    process.env.META_WHATSAPP_ACCESS_TOKEN = REAL_TOKEN; // present but must NOT be used in Mode B
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({
        useEnvFallback: false,
        accessTokenEncrypted: null,
        phoneNumberId: "phone_b",
      }),
    );

    const resolved = await resolveWhatsAppConnectionForBusiness(BUSINESS_A);
    expect(resolved.provider.name).toBe("disabled");
  });
});

describe("resolveWhatsAppConnectionForBusiness — Priority 2 env fallback (no connection)", () => {
  beforeEach(() => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
  });

  it("uses env credentials only when WHATSAPP_USE_ENV_FALLBACK=true and no active connection", async () => {
    process.env.WHATSAPP_USE_ENV_FALLBACK = "true";
    process.env.META_WHATSAPP_ACCESS_TOKEN = REAL_TOKEN;
    process.env.META_WHATSAPP_PHONE_NUMBER_ID = "env_phone";
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);

    const resolved = await resolveWhatsAppConnectionForBusiness(BUSINESS_A);

    expect(resolved.mode).toBe("env_fallback");
    expect(resolved.provider.name).toBe("meta_cloud_api");
    expect(resolved.phoneNumberId).toBe("env_phone");
    assertNoTokenLeak();
  });

  it("does NOT use env fallback when WHATSAPP_USE_ENV_FALLBACK is unset", async () => {
    process.env.META_WHATSAPP_ACCESS_TOKEN = REAL_TOKEN;
    process.env.META_WHATSAPP_PHONE_NUMBER_ID = "env_phone";
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);

    const resolved = await resolveWhatsAppConnectionForBusiness(BUSINESS_A);

    expect(resolved.mode).toBe("disconnected");
    expect(resolved.provider.name).toBe("disabled");
  });

  it("disconnected when env fallback enabled but credentials are missing", async () => {
    process.env.WHATSAPP_USE_ENV_FALLBACK = "true";
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);

    const resolved = await resolveWhatsAppConnectionForBusiness(BUSINESS_A);
    expect(resolved.mode).toBe("disconnected");
    expect(resolved.provider.name).toBe("disabled");
  });

  it("non-active connection (status=pending) -> disconnected, mentions status in uiStatus", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ status: "pending" }),
    );

    const resolved = await resolveWhatsAppConnectionForBusiness(BUSINESS_A);
    expect(resolved.mode).toBe("disconnected");
    expect(resolved.provider.name).toBe("disabled");
    expect(resolved.uiStatus).toContain("pending");
  });
});

describe("getDecryptedCredentialsForBusiness (server-only)", () => {
  beforeEach(() => {
    process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = ENCRYPTION_KEY;
  });

  it("returns null when there is no connection", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
    expect(await getDecryptedCredentialsForBusiness(BUSINESS_A)).toBeNull();
  });

  it("returns null when the connection is not active", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ status: "pending" }),
    );
    expect(await getDecryptedCredentialsForBusiness(BUSINESS_A)).toBeNull();
  });

  it("returns null in Mode B when token cannot be decrypted", async () => {
    process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = "c".repeat(64);
    const enc = encryptToken(REAL_TOKEN);
    process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = ENCRYPTION_KEY;
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ useEnvFallback: false, accessTokenEncrypted: enc }),
    );
    expect(await getDecryptedCredentialsForBusiness(BUSINESS_A)).toBeNull();
  });

  it("returns creds for an active Mode B connection", async () => {
    const enc = encryptToken(REAL_TOKEN);
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({
        useEnvFallback: false,
        accessTokenEncrypted: enc,
        phoneNumberId: "p1",
        wabaId: "w1",
      }),
    );
    const creds = await getDecryptedCredentialsForBusiness(BUSINESS_A);
    expect(creds?.accessToken).toBe(REAL_TOKEN);
    expect(creds?.phoneNumberId).toBe("p1");
    expect(creds?.wabaId).toBe("w1");
  });

  it("returns env token for an active Mode A connection", async () => {
    process.env.META_WHATSAPP_ACCESS_TOKEN = REAL_TOKEN;
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ useEnvFallback: true }),
    );
    const creds = await getDecryptedCredentialsForBusiness(BUSINESS_A);
    expect(creds?.accessToken).toBe(REAL_TOKEN);
  });
});

describe("getWhatsAppDiagnostic — never leaks tokens", () => {
  it("never includes the token value in any detail", async () => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    process.env.META_WHATSAPP_ACCESS_TOKEN = REAL_TOKEN;
    process.env.META_WHATSAPP_PHONE_NUMBER_ID = "p";
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ status: "active" }),
    );

    const diag = await getWhatsAppDiagnostic(BUSINESS_A);
    const serialized = JSON.stringify(diag);
    expect(serialized).not.toContain(REAL_TOKEN);
  });

  it("flags env-fallback and test-mode as NOT recommended (ok=false)", async () => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    process.env.WHATSAPP_USE_ENV_FALLBACK = "true";
    process.env.WHATSAPP_TEST_MODE = "true";
    process.env.META_WHATSAPP_ACCESS_TOKEN = REAL_TOKEN;
    process.env.META_WHATSAPP_PHONE_NUMBER_ID = "p";
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);

    const diag = await getWhatsAppDiagnostic(BUSINESS_A);
    const envDetail = diag.details.find((d) => d.label.includes("USE_ENV_FALLBACK"));
    const testDetail = diag.details.find((d) => d.label.includes("TEST_MODE"));
    expect(envDetail?.ok).toBe(false);
    expect(testDetail?.ok).toBe(false);
  });

  it("dev mode (real send off) -> ok=false with dev status label", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
    const diag = await getWhatsAppDiagnostic(BUSINESS_A);
    expect(diag.ok).toBe(false);
    expect(diag.statusLabel).toContain("פיתוח");
  });
});

describe("getWhatsAppReadiness — production readiness states", () => {
  beforeEach(() => {
    process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = ENCRYPTION_KEY;
  });

  it("not_connected when no row exists", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
    const r = await getWhatsAppReadiness(BUSINESS_A);
    expect(r.ready).toBe(false);
    expect(r.state).toBe("not_connected");
  });

  it("pending state", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ status: "pending" }),
    );
    const r = await getWhatsAppReadiness(BUSINESS_A);
    expect(r.state).toBe("pending");
    expect(r.ready).toBe(false);
  });

  it("error state surfaces lastError reason", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ status: "error", lastError: "כשל באימות" }),
    );
    const r = await getWhatsAppReadiness(BUSINESS_A);
    expect(r.state).toBe("error");
    expect(r.reason).toBe("כשל באימות");
  });

  it("active Mode A is ready (no token decryption required)", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ status: "active", useEnvFallback: true }),
    );
    const r = await getWhatsAppReadiness(BUSINESS_A);
    expect(r.ready).toBe(true);
    expect(r.state).toBe("active");
  });

  it("active Mode B with undecryptable token -> not ready, safe reason, NO token", async () => {
    process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = "d".repeat(64);
    const enc = encryptToken(REAL_TOKEN);
    process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = ENCRYPTION_KEY;
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({
        status: "active",
        useEnvFallback: false,
        accessTokenEncrypted: enc,
        phoneNumberId: "p",
      }),
    );

    const r = await getWhatsAppReadiness(BUSINESS_A);
    expect(r.ready).toBe(false);
    expect(r.state).toBe("error");
    expect(r.reason).toContain("פענוח");
    expect(JSON.stringify(r)).not.toContain(REAL_TOKEN);
  });

  it("active Mode B with a decryptable token is ready", async () => {
    const enc = encryptToken(REAL_TOKEN);
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({
        status: "active",
        useEnvFallback: false,
        accessTokenEncrypted: enc,
        phoneNumberId: "p",
      }),
    );
    const r = await getWhatsAppReadiness(BUSINESS_A);
    expect(r.ready).toBe(true);
  });

  it("active but missing phoneNumberId -> error", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ status: "active", useEnvFallback: true, phoneNumberId: null }),
    );
    const r = await getWhatsAppReadiness(BUSINESS_A);
    expect(r.ready).toBe(false);
    expect(r.state).toBe("error");
  });

  it("never returns the token in any readiness result", async () => {
    const enc = encryptToken(REAL_TOKEN);
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({
        status: "active",
        useEnvFallback: false,
        accessTokenEncrypted: enc,
        phoneNumberId: "p",
      }),
    );
    const r = await getWhatsAppReadiness(BUSINESS_A);
    expect(JSON.stringify(r)).not.toContain(REAL_TOKEN);
    expect(JSON.stringify(r)).not.toContain(enc);
  });
});
