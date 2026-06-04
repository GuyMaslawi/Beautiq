import bcrypt from "bcryptjs";

/**
 * Password hashing helpers.
 *
 * We never store plain passwords — only a bcrypt hash lives in User.passwordHash.
 * bcryptjs is a pure-JS implementation, so it needs no native build step and runs
 * reliably across environments. The work factor (cost) is a deliberate balance
 * between security and login latency.
 */
const SALT_ROUNDS = 12;

/** Hash a plain-text password for storage. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Verify a plain-text password against a stored hash. */
export async function verifyPassword(
  plain: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, passwordHash);
}
