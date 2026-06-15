/**
 * Payment provider credential encryption (AES-256-GCM).
 *
 * Used to encrypt a business's payment-provider credentials before storing
 * them in PaymentProviderConnection.credentialsEncrypted.
 *
 * Key: PAYMENTS_CREDENTIALS_ENCRYPTION_KEY
 *   - 64 hex chars (32 bytes), or
 *   - base64 of 32 bytes, or
 *   - any string ≥ 32 chars (derived to 32 bytes via scrypt with a fixed salt).
 *
 * Stored format: "v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>"
 *
 * SAFETY:
 *   - This module never logs the plaintext credentials or the key.
 *   - Decryption failures throw a generic error with no credential content.
 *   - Server-only — never import from a client component.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard nonce length
const KEY_LENGTH = 32; // 256-bit
const VERSION = "v1";
// Fixed salt: the secret entropy comes from the env key, not the salt.
const SCRYPT_SALT = "allura-payments-credentials-v1";

/** Resolves the configured encryption key to a 32-byte Buffer, or throws. */
function getKey(): Buffer {
  const raw = process.env.PAYMENTS_CREDENTIALS_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error(
      "PAYMENTS_CREDENTIALS_ENCRYPTION_KEY is missing or too short (need ≥32 chars / 32 bytes).",
    );
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  if (/^[A-Za-z0-9+/]+=*$/.test(raw)) {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === KEY_LENGTH) return decoded;
  }

  return scryptSync(raw, SCRYPT_SALT, KEY_LENGTH);
}

/** True when an encryption key is configured. */
export function isPaymentsEncryptionConfigured(): boolean {
  const raw = process.env.PAYMENTS_CREDENTIALS_ENCRYPTION_KEY;
  return !!raw && raw.length >= 32;
}

/** Encrypts a plaintext secret. Returns the versioned, self-describing string. */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/**
 * Decrypts a secret produced by encryptSecret().
 * Throws a generic error on any malformed input, key mismatch, or auth failure.
 */
export function decryptSecret(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Encrypted secret has an unexpected format.");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Safe wrapper: returns null instead of throwing when decryption fails. */
export function tryDecryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    return decryptSecret(stored);
  } catch {
    return null;
  }
}

/** Encrypts a JSON-serializable credentials object. */
export function encryptCredentials(creds: Record<string, unknown>): string {
  return encryptSecret(JSON.stringify(creds));
}

/** Decrypts a credentials object; returns null on any failure. */
export function tryDecryptCredentials(
  stored: string | null | undefined,
): Record<string, unknown> | null {
  const plain = tryDecryptSecret(stored);
  if (!plain) return null;
  try {
    return JSON.parse(plain) as Record<string, unknown>;
  } catch {
    return null;
  }
}
