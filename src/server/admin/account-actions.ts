"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { AccountPlan } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { requirePlatformAdmin } from "./auth";
import { getCurrentUser } from "@/server/auth/session";
import { hashPassword } from "@/server/auth/password";
import { logActivity } from "@/server/activity/log";

// ---------------------------------------------------------------------------
// "God-mode" account controls — platform-admin only.
//
// These act on the OWNER User of a given business: overriding paid access,
// resetting the login password, and toggling platform-admin. Every action
// re-verifies admin, confirms the target is genuinely the owner of THIS
// business (defense in depth — never operate on an arbitrary user id from the
// client), and writes an audit entry.
// ---------------------------------------------------------------------------

/** Resolve the owner User of a business, or null. */
async function getOwnerUser(businessId: string, expectedUserId: string) {
  const membership = await prisma.businessUser.findFirst({
    where: { businessId, role: "owner", userId: expectedUserId },
    select: { user: { select: { id: true, name: true, email: true, isAdmin: true } } },
  });
  return membership?.user ?? null;
}

export interface AdminActionResult {
  success: boolean;
  error?: string;
  /** One-time secret to display (e.g. a freshly reset password). */
  secret?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Account access & plan override
// ---------------------------------------------------------------------------

/**
 * Grant or revoke paid access for the owner, bypassing Grow billing. `"none"`
 * revokes access (the app gate sends them back to /subscribe); `premium`/
 * `platinum` open the app immediately (platinum also unlocks the growth tools).
 *
 * `expiresAt` (optional ISO date) makes it a COMPED, time-limited plan — access
 * lapses automatically the moment it passes (enforced live in getCurrentUser).
 * Omit / null for an open-ended grant.
 */
export async function adminSetAccountPlanAction(
  businessId: string,
  targetUserId: string,
  plan: "premium" | "platinum" | "none",
  expiresAt?: string | null,
): Promise<AdminActionResult> {
  await requirePlatformAdmin();

  const owner = await getOwnerUser(businessId, targetUserId);
  if (!owner) return { success: false, error: "לא נמצאה בעלת העסק." };

  const newPlan = plan === "none" ? null : (plan as AccountPlan);

  let expiry: Date | null = null;
  if (newPlan && expiresAt) {
    const d = new Date(expiresAt);
    if (isNaN(d.getTime())) return { success: false, error: "תאריך תפוגה לא תקין." };
    if (d.getTime() <= Date.now()) {
      return { success: false, error: "תאריך התפוגה חייב להיות בעתיד." };
    }
    expiry = d;
  }

  await prisma.user.update({
    where: { id: owner.id },
    data: {
      plan: newPlan,
      planActivatedAt: newPlan ? new Date() : null,
      // Clear any prior expiry unless a new one is set.
      planExpiresAt: expiry,
    },
  });

  const label =
    plan === "none" ? "ללא גישה" : plan === "platinum" ? "פלטינום" : "פרימיום";
  const suffix = expiry
    ? ` (חינם עד ${expiry.toLocaleDateString("he-IL")})`
    : "";
  await logActivity({
    businessId,
    category: "subscription",
    action: "admin.plan_override",
    summary: `מנהל שינה את תוכנית ${owner.name ?? owner.email} ל־${label}${suffix}`,
    actorType: "admin",
    metadata: { targetUserId: owner.id, plan, expiresAt: expiry?.toISOString() ?? null },
  });

  revalidatePath(`/admin/businesses/${businessId}`);
  revalidatePath("/admin");
  return { success: true, message: `התוכנית עודכנה ל־${label}${suffix}.` };
}

// ---------------------------------------------------------------------------
// Temporary suspension
// ---------------------------------------------------------------------------

/**
 * Suspend the owner's access until a date, or lift an existing suspension
 * (`until = null`). While suspended the app gate blocks access (→ /suspended)
 * and paying cannot bypass it.
 */
export async function adminSuspendAccountAction(
  businessId: string,
  targetUserId: string,
  until: string | null,
): Promise<AdminActionResult> {
  await requirePlatformAdmin();

  const owner = await getOwnerUser(businessId, targetUserId);
  if (!owner) return { success: false, error: "לא נמצאה בעלת העסק." };

  let suspendedUntil: Date | null = null;
  if (until) {
    const d = new Date(until);
    if (isNaN(d.getTime())) return { success: false, error: "תאריך לא תקין." };
    if (d.getTime() <= Date.now()) {
      return { success: false, error: "תאריך סיום ההשהיה חייב להיות בעתיד." };
    }
    suspendedUntil = d;
  }

  await prisma.user.update({
    where: { id: owner.id },
    data: { suspendedUntil },
  });

  await logActivity({
    businessId,
    category: "admin",
    action: suspendedUntil ? "admin.suspend" : "admin.unsuspend",
    summary: suspendedUntil
      ? `מנהל השהה את ${owner.name ?? owner.email} עד ${suspendedUntil.toLocaleDateString("he-IL")}`
      : `מנהל ביטל את ההשהיה של ${owner.name ?? owner.email}`,
    actorType: "admin",
    metadata: { targetUserId: owner.id, until: suspendedUntil?.toISOString() ?? null },
  });

  revalidatePath(`/admin/businesses/${businessId}`);
  revalidatePath("/admin");
  return {
    success: true,
    message: suspendedUntil
      ? `החשבון הושהה עד ${suspendedUntil.toLocaleDateString("he-IL")}.`
      : "ההשהיה בוטלה.",
  };
}

// ---------------------------------------------------------------------------
// Transfer ownership
// ---------------------------------------------------------------------------

/**
 * Move ownership of a business to a different user (looked up by login email).
 * The current owner membership is reassigned to the target; any pre-existing
 * membership the target had on this business is removed first to respect the
 * (userId, businessId) uniqueness. The new owner's own plan then gates access.
 */
export async function adminTransferOwnershipAction(
  businessId: string,
  newOwnerEmail: string,
): Promise<AdminActionResult> {
  await requirePlatformAdmin();

  const email = newOwnerEmail.trim();
  if (!email) return { success: false, error: "יש להזין אימייל." };

  const target = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, name: true, email: true },
  });
  if (!target) {
    return { success: false, error: "לא נמצא משתמש עם אימייל זה." };
  }

  const ownerMembership = await prisma.businessUser.findFirst({
    where: { businessId, role: "owner" },
    orderBy: { createdAt: "asc" },
    select: { id: true, userId: true },
  });
  if (!ownerMembership) {
    return { success: false, error: "לא נמצאה בעלות נוכחית לעסק." };
  }
  if (ownerMembership.userId === target.id) {
    return { success: false, error: "המשתמש כבר הבעלים של העסק." };
  }

  await prisma.$transaction(async (tx) => {
    // Remove any existing membership the target holds on this business so the
    // owner row can be reassigned without hitting the unique constraint.
    await tx.businessUser.deleteMany({
      where: { businessId, userId: target.id },
    });
    await tx.businessUser.update({
      where: { id: ownerMembership.id },
      data: { userId: target.id, role: "owner" },
    });
  });

  await logActivity({
    businessId,
    category: "admin",
    action: "admin.transfer_ownership",
    summary: `מנהל העביר את הבעלות על העסק ל${target.name ?? target.email}`,
    actorType: "admin",
    metadata: { newOwnerId: target.id, previousOwnerId: ownerMembership.userId },
  });

  revalidatePath(`/admin/businesses/${businessId}`);
  revalidatePath("/admin/businesses");
  return {
    success: true,
    message: `הבעלות הועברה ל${target.name ?? target.email}.`,
  };
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

/** Generate a readable, strong temporary password. */
function generateTempPassword(): string {
  // ~13 url-safe chars — no ambiguous separators to read out.
  return randomBytes(10).toString("base64url").slice(0, 13);
}

/**
 * Reset the owner's login password. If `newPassword` is provided (≥8 chars) it
 * is used; otherwise a strong temporary one is generated. The plaintext is
 * returned ONCE for the admin to hand off — it is never stored or logged.
 */
export async function adminResetPasswordAction(
  businessId: string,
  targetUserId: string,
  newPassword?: string,
): Promise<AdminActionResult> {
  await requirePlatformAdmin();

  const owner = await getOwnerUser(businessId, targetUserId);
  if (!owner) return { success: false, error: "לא נמצאה בעלת העסק." };

  const provided = (newPassword ?? "").trim();
  if (provided && provided.length < 8) {
    return { success: false, error: "סיסמה חייבת להכיל לפחות 8 תווים." };
  }
  const plain = provided || generateTempPassword();

  await prisma.user.update({
    where: { id: owner.id },
    data: { passwordHash: await hashPassword(plain) },
  });

  await logActivity({
    businessId,
    category: "admin",
    action: "admin.password_reset",
    summary: `מנהל איפס את הסיסמה של ${owner.name ?? owner.email}`,
    actorType: "admin",
    metadata: { targetUserId: owner.id },
  });

  revalidatePath(`/admin/businesses/${businessId}`);
  return { success: true, secret: plain, message: "הסיסמה אופסה." };
}

// ---------------------------------------------------------------------------
// Platform-admin role toggle
// ---------------------------------------------------------------------------

/**
 * Promote or demote the owner to/from platform admin. An admin can never demote
 * themselves (avoids locking the platform out of its own admin).
 */
export async function adminToggleAdminRoleAction(
  businessId: string,
  targetUserId: string,
  makeAdmin: boolean,
): Promise<AdminActionResult> {
  await requirePlatformAdmin();

  const me = await getCurrentUser();
  if (me && me.id === targetUserId && !makeAdmin) {
    return { success: false, error: "אי אפשר להסיר את הרשאת האדמין מעצמך." };
  }

  const owner = await getOwnerUser(businessId, targetUserId);
  if (!owner) return { success: false, error: "לא נמצאה בעלת העסק." };

  await prisma.user.update({
    where: { id: owner.id },
    data: { isAdmin: makeAdmin },
  });

  await logActivity({
    businessId,
    category: "admin",
    action: makeAdmin ? "admin.promote" : "admin.demote",
    summary: `מנהל ${makeAdmin ? "קידם" : "הסיר הרשאת אדמין מ"}${owner.name ?? owner.email}`,
    actorType: "admin",
    metadata: { targetUserId: owner.id, makeAdmin },
  });

  revalidatePath(`/admin/businesses/${businessId}`);
  return {
    success: true,
    message: makeAdmin ? "המשתמש קודם למנהל." : "הרשאת האדמין הוסרה.",
  };
}
