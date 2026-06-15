import { describe, it, expect, beforeEach } from "vitest";
import {
  encryptSecret,
  decryptSecret,
  tryDecryptSecret,
  encryptCredentials,
  tryDecryptCredentials,
  isPaymentsEncryptionConfigured,
} from "@/lib/payments/crypto";

const KEY = "0".repeat(64); // 32 bytes hex

describe("payments crypto", () => {
  beforeEach(() => {
    process.env.PAYMENTS_CREDENTIALS_ENCRYPTION_KEY = KEY;
  });

  it("round-trips a secret", () => {
    const enc = encryptSecret("super-secret-token");
    expect(enc).not.toContain("super-secret-token");
    expect(enc.startsWith("v1:")).toBe(true);
    expect(decryptSecret(enc)).toBe("super-secret-token");
  });

  it("round-trips a credentials object", () => {
    const creds = { apiKey: "k_123", terminal: "T1" };
    const enc = encryptCredentials(creds);
    expect(enc).not.toContain("k_123");
    expect(tryDecryptCredentials(enc)).toEqual(creds);
  });

  it("fails closed on a tampered ciphertext", () => {
    const enc = encryptSecret("token");
    // Corrupt the auth-tag segment (16 bytes / 24 base64 chars, no padding) so
    // a single char change is guaranteed to alter the decoded bytes.
    const parts = enc.split(":");
    parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
    expect(tryDecryptSecret(parts.join(":"))).toBeNull();
  });

  it("fails closed when the key changes", () => {
    const enc = encryptSecret("token");
    process.env.PAYMENTS_CREDENTIALS_ENCRYPTION_KEY = "1".repeat(64);
    expect(tryDecryptSecret(enc)).toBeNull();
  });

  it("reports configuration state", () => {
    expect(isPaymentsEncryptionConfigured()).toBe(true);
    delete process.env.PAYMENTS_CREDENTIALS_ENCRYPTION_KEY;
    expect(isPaymentsEncryptionConfigured()).toBe(false);
  });

  it("tryDecrypt returns null for empty input", () => {
    expect(tryDecryptSecret(null)).toBeNull();
    expect(tryDecryptSecret(undefined)).toBeNull();
    expect(tryDecryptSecret("")).toBeNull();
  });
});
