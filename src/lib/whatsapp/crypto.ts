/**
 * WhatsApp credential encryption (AES-256-GCM).
 *
 * Used to encrypt the per-business Meta access token before storing it in
 * WhatsAppConnection.accessTokenEncrypted (Mode B / Embedded Signup).
 *
 * Key: WHATSAPP_CREDENTIALS_ENCRYPTION_KEY
 *   - 64 hex chars (32 bytes), or
 *   - base64 of 32 bytes, or
 *   - any string ≥ 32 chars (derived to 32 bytes via scrypt with a fixed salt).
 *
 * Stored format: "v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>"
 *
 * SAFETY:
 *   - This module never logs the plaintext token or the key.
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
const SCRYPT_SALT = "allura-whatsapp-credentials-v1";

/** Resolves the configured encryption key to a 32-byte Buffer, or throws. */
function getKey(): Buffer {
  const raw = process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error(
      "WHATSAPP_CREDENTIALS_ENCRYPTION_KEY is missing or too short (need ≥32 chars / 32 bytes).",
    );
  }

  // 64 hex chars → 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  // base64 that decodes to exactly 32 bytes
  if (/^[A-Za-z0-9+/]+=*$/.test(raw)) {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === KEY_LENGTH) return decoded;
  }

  // Fallback: derive a stable 32-byte key from an arbitrary passphrase
  return scryptSync(raw, SCRYPT_SALT, KEY_LENGTH);
}

/** True when an encryption key is configured (does not validate length strictly). */
export function isEncryptionConfigured(): boolean {
  const raw = process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY;
  return !!raw && raw.length >= 32;
}

/** Encrypts a plaintext token. Returns the versioned, self-describing string. */
export function encryptToken(plaintext: string): string {
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
 * Decrypts a token produced by encryptToken().
 * Throws a generic error on any malformed input, key mismatch, or auth failure.
 */
export function decryptToken(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Encrypted token has an unexpected format.");
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
export function tryDecryptToken(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    return decryptToken(stored);
  } catch {
    return null;
  }
}
