/**
 * Admin impersonation ("login as owner") — signed-cookie plumbing.
 *
 * When a platform admin impersonates a business owner, we DO NOT touch the
 * NextAuth session (that still belongs to the admin). Instead we set a short-
 * lived, HMAC-signed cookie naming the target user. getCurrentUser() honors it
 * ONLY when the underlying session user is a real admin, so the whole app then
 * renders as the owner. Clearing the cookie instantly restores the admin.
 *
 * The signature (keyed on AUTH_SECRET) makes the cookie unforgeable — a user
 * cannot self-elevate by crafting one, since they cannot produce a valid MAC.
 *
 * Server-only. This module must NOT import session.ts (session.ts imports it).
 */

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

export const IMPERSONATION_COOKIE = "allura_impersonation";
export const IMPERSONATION_MAX_AGE = 60 * 60 * 2; // 2 hours

export interface ImpersonationPayload {
  /** The admin who initiated impersonation — must match the live session user. */
  adminId: string;
  /** The owner being impersonated. */
  targetUserId: string;
  /** The owner's business, for "return to" navigation + activity scoping. */
  businessId: string | null;
  startedAt: number;
}

function secret(): string {
  return process.env.AUTH_SECRET ?? "dev-insecure-impersonation-secret";
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function encodeImpersonation(payload: ImpersonationPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeImpersonation(value: string): ImpersonationPayload | null {
  const dot = value.indexOf(".");
  if (dot < 1) return null;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);

  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as ImpersonationPayload;
  } catch {
    return null;
  }
}

/**
 * Read + verify the impersonation cookie, if present and well-formed. Resilient:
 * returns null if the cookie store is unavailable (e.g. outside a request scope)
 * rather than throwing into the caller (getCurrentUser runs on every request).
 */
export async function readImpersonationCookie(): Promise<ImpersonationPayload | null> {
  try {
    const store = await cookies();
    const raw = store.get(IMPERSONATION_COOKIE)?.value;
    if (!raw) return null;
    return decodeImpersonation(raw);
  } catch {
    return null;
  }
}
