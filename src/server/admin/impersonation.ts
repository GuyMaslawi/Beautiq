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

/**
 * The HMAC key. Fails CLOSED: with no AUTH_SECRET there is no safe key to sign
 * with, so we refuse rather than fall back to a hardcoded string that would make
 * every impersonation cookie forgeable by anyone who has read this file.
 */
function secret(): string {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s) {
    throw new Error(
      "AUTH_SECRET is required to sign impersonation cookies (openssl rand -base64 32).",
    );
  }
  return s;
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

  let payload: ImpersonationPayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as ImpersonationPayload;
  } catch {
    return null;
  }

  // Enforce the 2-hour window HERE, server-side. The cookie's maxAge is only a
  // browser hint: a copied cookie value stays a valid bearer credential forever
  // if nothing checks startedAt, letting an admin (or anyone who obtained the
  // value) silently re-enter a tenant later with no admin.impersonate_start
  // entry in the audit log. Future-dated tokens are rejected too, so a skewed or
  // crafted startedAt cannot extend the window.
  const now = Date.now();
  if (
    typeof payload.startedAt !== "number" ||
    !Number.isFinite(payload.startedAt) ||
    now - payload.startedAt > IMPERSONATION_MAX_AGE * 1000 ||
    payload.startedAt > now + 60_000
  ) {
    return null;
  }

  return payload;
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
