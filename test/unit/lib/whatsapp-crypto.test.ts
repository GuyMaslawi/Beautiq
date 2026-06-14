import { describe, it, expect, beforeEach } from "vitest";
import {
  encryptToken,
  decryptToken,
  tryDecryptToken,
  isEncryptionConfigured,
} from "@/lib/whatsapp/crypto";

const HEX_KEY = "a".repeat(64); // 32 bytes hex
const PASSPHRASE_KEY = "this-is-a-long-enough-passphrase-key-1234567890";

describe("whatsapp crypto", () => {
  describe("with a 64-hex-char key", () => {
    beforeEach(() => {
      process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = HEX_KEY;
    });

    it("round-trips a token", () => {
      const secret = "EAAB_super_secret_meta_token";
      const enc = encryptToken(secret);
      expect(decryptToken(enc)).toBe(secret);
    });

    it("produces the versioned self-describing format", () => {
      const enc = encryptToken("x");
      const parts = enc.split(":");
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe("v1");
    });

    it("never stores the plaintext in the ciphertext string", () => {
      const secret = "PLAINTEXT_SHOULD_NOT_APPEAR";
      const enc = encryptToken(secret);
      expect(enc).not.toContain(secret);
    });

    it("uses a random IV — same plaintext encrypts to different ciphertexts", () => {
      expect(encryptToken("same")).not.toBe(encryptToken("same"));
    });

    it("throws on tampered ciphertext (auth tag mismatch)", () => {
      const enc = encryptToken("secret");
      const parts = enc.split(":");
      const tampered = [parts[0], parts[1], parts[2], "AAAA" + parts[3].slice(4)].join(":");
      expect(() => decryptToken(tampered)).toThrow();
    });

    it("throws on malformed input", () => {
      expect(() => decryptToken("not-a-valid-token")).toThrow();
      expect(() => decryptToken("v2:a:b:c")).toThrow();
    });
  });

  describe("with a passphrase-derived key (scrypt)", () => {
    beforeEach(() => {
      process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = PASSPHRASE_KEY;
    });

    it("round-trips a token via scrypt-derived key", () => {
      const enc = encryptToken("hello");
      expect(decryptToken(enc)).toBe("hello");
    });
  });

  describe("key mismatch", () => {
    it("fails to decrypt a token encrypted under a different key", () => {
      process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = HEX_KEY;
      const enc = encryptToken("secret");
      process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = "b".repeat(64);
      expect(() => decryptToken(enc)).toThrow();
    });
  });

  describe("missing key", () => {
    it("throws on encrypt when key missing", () => {
      delete process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY;
      expect(() => encryptToken("x")).toThrow();
    });

    it("isEncryptionConfigured reflects presence and length", () => {
      delete process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY;
      expect(isEncryptionConfigured()).toBe(false);
      process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = "short";
      expect(isEncryptionConfigured()).toBe(false);
      process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = HEX_KEY;
      expect(isEncryptionConfigured()).toBe(true);
    });
  });

  describe("tryDecryptToken", () => {
    beforeEach(() => {
      process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = HEX_KEY;
    });

    it("returns null for null/undefined/empty input", () => {
      expect(tryDecryptToken(null)).toBeNull();
      expect(tryDecryptToken(undefined)).toBeNull();
      expect(tryDecryptToken("")).toBeNull();
    });

    it("returns null instead of throwing on malformed input", () => {
      expect(tryDecryptToken("garbage")).toBeNull();
    });

    it("returns the plaintext for a valid token", () => {
      const enc = encryptToken("ok");
      expect(tryDecryptToken(enc)).toBe("ok");
    });
  });
});
