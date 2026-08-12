"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { AccountPlan, AccountSubscriptionStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { requirePlatformAdmin } from "./auth";
import { getCurrentUser } from "@/server/auth/session";
import { hashPassword } from "@/server/auth/password";
import { logActivity } from "@/server/activity/log";
import {
  effectivePriceMinor,
  MIN_CUSTOM_PRICE_MINOR,
  MAX_CUSTOM_PRICE_MINOR,
} from "@/server/subscription/service";
import { cancelDirectDebit, isGrowConfigured } from "@/lib/subscription/grow";

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
    select: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          isAdmin: true,
          plan: true,
          customPriceMinor: true,
        },
      },
    },
  });
  return membership?.user ?? null;
}

/**
 * Push a plan/price change onto the owner's EXISTING billing row (never
 * fabricate one — a comped or grandfathered account has no Grow subscription).
 *
 * Grow bills a standing order (הוראת קבע) at a fixed amount it will not let us
 * edit in place. So when the monthly amount really changes on a LIVE standing
 * order, we stop the old order and drop the row back to `pending`: the owner
 * re-authorizes her card at the new price from her settings page (the admin
 * never touches card data) and the charge resumes automatically. Access stays
 * open the whole time. Returns true when that re-authorization is now pending.
 *
 * A comped grant (time-limited free access) never disturbs a live standing order.
 */
async function syncSubscriptionBilling(
  userId: string,
  plan: AccountPlan,
  priceMinor: number,
  opts: { comped: boolean },
): Promise<boolean> {
  const sub = await prisma.accountSubscription.findUnique({
    where: { userId },
    select: { id: true, status: true, directDebitId: true, priceMinor: true },
  });
  if (!sub) return false;

  const hasLiveDirectDebit =
    isGrowConfigured() &&
    !!sub.directDebitId &&
    (sub.status === AccountSubscriptionStatus.active ||
      sub.status === AccountSubscriptionStatus.past_due);

  if (hasLiveDirectDebit && sub.priceMinor !== priceMinor && !opts.comped) {
    await prisma.accountSubscription.update({
      where: { id: sub.id },
      data: {
        plan,
        priceMinor,
        status: AccountSubscriptionStatus.pending,
        directDebitId: null,
        cardSuffix: null,
        processId: null,
        processToken: null,
      },
    });
    await cancelDirectDebit(sub.directDebitId!);
    return true;
  }

  // Comped / dev-mock / same-amount change: just mirror the plan + recorded
  // price so the owner's "מנוי" card shows the right monthly amount. With no
  // live standing order, this recorded price IS the billing.
  await prisma.accountSubscription.update({
    where: { id: sub.id },
    data: { plan, priceMinor },
  });
  return false;
}

/** "₪199" / "₪99.50" — an agorot amount for Hebrew copy. */
function shekels(minor: number): string {
  return `₪${minor % 100 === 0 ? minor / 100 : (minor / 100).toFixed(2)}`;
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
 * revokes access (the app gate sends them back to /subscribe); `"standard"` —
 * the single Allura plan — opens the app, with every feature, immediately.
 *
 * `expiresAt` (optional ISO date) makes it a COMPED, time-limited plan — access
 * lapses automatically the moment it passes (enforced live in getCurrentUser).
 * Omit / null for an open-ended grant.
 */
export async function adminSetAccountPlanAction(
  businessId: string,
  targetUserId: string,
  plan: "standard" | "none",
  expiresAt?: string | null,
): Promise<AdminActionResult> {
  await requirePlatformAdmin();

  const owner = await getOwnerUser(businessId, targetUserId);
  if (!owner) return { success: false, error: "לא נמצאה בעלת העסק." };

  return applyAccountPlan(owner, plan, expiresAt ?? null, businessId);
}

/**
 * The same grant, addressed by USER instead of by business — the flow that
 * matters at launch.
 *
 * A new owner signs up and immediately hits the paywall: she cannot create her
 * business until she has access, so there is no business row, and the
 * business-scoped control above cannot reach her at all. Handing a waiting owner
 * a free trial has to work on the account itself, before anything else exists.
 *
 * Accepts any user id (the target need not own a business yet); everything else —
 * expiry validation, billing sync, audit — is identical.
 */
export async function adminSetAccountPlanByUserAction(
  targetUserId: string,
  plan: "standard" | "none",
  expiresAt?: string | null,
): Promise<AdminActionResult> {
  await requirePlatformAdmin();

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      plan: true,
      customPriceMinor: true,
      // The audit entry is attached to her business when she already has one.
      memberships: {
        where: { role: "owner" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { businessId: true },
      },
    },
  });
  if (!target) return { success: false, error: "לא נמצא משתמש." };

  return applyAccountPlan(
    target,
    plan,
    expiresAt ?? null,
    target.memberships[0]?.businessId ?? null,
  );
}

/** Shared core of both grant paths. `businessId` is only used for the audit log. */
async function applyAccountPlan(
  owner: { id: string; name: string | null; email: string; customPriceMinor: number | null },
  plan: "standard" | "none",
  expiresAt: string | null,
  businessId: string | null,
): Promise<AdminActionResult> {
  const newPlan = plan === "none" ? null : (plan as AccountPlan);

  let expiry: Date | null = null;
  if (newPlan && expiresAt) {
    // A bare `yyyy-mm-dd` parses as midnight UTC — 02:00/03:00 in Israel — so a
    // "trial until the 30th" would actually have died in the small hours of the
    // 30th, costing the owner her last day. Take the end of that day instead.
    const d = /^\d{4}-\d{2}-\d{2}$/.test(expiresAt.trim())
      ? new Date(`${expiresAt.trim()}T23:59:59.999+02:00`)
      : new Date(expiresAt);
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

  // Keep the monthly billing record in sync with the admin's plan change. The
  // owner's negotiated price (if an admin set one) outranks the plan list price
  // and survives the plan change — it holds until an admin says otherwise.
  const newPriceMinor = newPlan
    ? effectivePriceMinor(owner.customPriceMinor)
    : 0;

  // True when we stopped a live standing order and the owner must re-authorize
  // her card at the new price for the recurring charge to resume.
  let billingReauthRequired = false;

  if (newPlan) {
    billingReauthRequired = await syncSubscriptionBilling(
      owner.id,
      newPlan,
      newPriceMinor,
      { comped: !!expiry },
    );
  } else {
    // Revoking access → stop billing and the standing order.
    const existingSub = await prisma.accountSubscription.findUnique({
      where: { userId: owner.id },
      select: { id: true, status: true, directDebitId: true },
    });
    if (
      existingSub &&
      (existingSub.status === AccountSubscriptionStatus.active ||
        existingSub.status === AccountSubscriptionStatus.past_due)
    ) {
      await prisma.accountSubscription.update({
        where: { id: existingSub.id },
        data: { status: AccountSubscriptionStatus.cancelled, cancelledAt: new Date() },
      });
      if (existingSub.directDebitId) {
        await cancelDirectDebit(existingSub.directDebitId);
      }
    }
  }

  const label = plan === "none" ? "ללא גישה" : "מנוי Allura";
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

  if (businessId) revalidatePath(`/admin/businesses/${businessId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/accounts");
  const message = billingReauthRequired
    ? `התוכנית עודכנה ל־${label}. הוראת הקבע הישנה בוטלה כדי לא לחייב בסכום שגוי — ` +
      `בעלת העסק תתבקש לאשר מחדש את אמצעי התשלום בסכום החדש (${shekels(newPriceMinor)} לחודש) ` +
      `בעמוד ההגדרות שלה, ואז החיוב יתחדש אוטומטית. הגישה נשמרת בינתיים.`
    : `התוכנית עודכנה ל־${label}${suffix}.`;
  return { success: true, message };
}

// ---------------------------------------------------------------------------
// Custom monthly price
// ---------------------------------------------------------------------------

/**
 * Set (or clear) the owner's negotiated monthly price — a permanent override of
 * the plan list price that holds "until further notice": it applies to her first
 * checkout, to every monthly renewal, and survives an admin plan change. Pass
 * `null` to go back to the list price of her plan.
 *
 * `priceShekels` is whole shekels, as typed in the admin form. If she is already
 * paying through a live Grow standing order at a different amount, that order is
 * stopped and she re-authorizes her card at the new price (Grow cannot change a
 * standing order's amount in place) — access is never interrupted.
 */
export async function adminSetCustomPriceAction(
  businessId: string,
  targetUserId: string,
  priceShekels: number | null,
): Promise<AdminActionResult> {
  await requirePlatformAdmin();

  const owner = await getOwnerUser(businessId, targetUserId);
  if (!owner) return { success: false, error: "לא נמצאה בעלת העסק." };

  return applyCustomPrice(owner, priceShekels, businessId);
}

/**
 * The same, addressed by account rather than by business.
 *
 * A price agreed BEFORE she has a business is the ordinary case, not an edge
 * one: the paywall stands between signup and onboarding, so an owner you
 * negotiated with is sitting at /subscribe with no business to hang a price on.
 * Through the business-scoped path above she could not be priced at all, and if
 * she paid before you got to her she was charged the full list price.
 */
export async function adminSetCustomPriceByUserAction(
  targetUserId: string,
  priceShekels: number | null,
): Promise<AdminActionResult> {
  await requirePlatformAdmin();

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
      customPriceMinor: true,
      // Only for the audit entry — absent until she finishes onboarding.
      memberships: {
        where: { role: "owner" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { businessId: true },
      },
    },
  });
  if (!target) return { success: false, error: "לא נמצא משתמש." };

  return applyCustomPrice(target, priceShekels, target.memberships[0]?.businessId ?? null);
}

/** Shared core of both pricing paths. `businessId` is only used for the audit log. */
async function applyCustomPrice(
  owner: {
    id: string;
    name: string | null;
    email: string;
    plan: AccountPlan | null;
    customPriceMinor: number | null;
  },
  priceShekels: number | null,
  businessId: string | null,
): Promise<AdminActionResult> {
  let customPriceMinor: number | null = null;
  if (priceShekels !== null) {
    if (typeof priceShekels !== "number" || !Number.isFinite(priceShekels)) {
      return { success: false, error: "יש להזין סכום חודשי תקין." };
    }
    // Whole shekels only — agorot in a monthly bill are a typo, not a price.
    const minor = Math.round(priceShekels) * 100;
    if (minor < MIN_CUSTOM_PRICE_MINOR || minor > MAX_CUSTOM_PRICE_MINOR) {
      return {
        success: false,
        error: `הסכום החודשי חייב להיות בין ${shekels(MIN_CUSTOM_PRICE_MINOR)} ל־${shekels(MAX_CUSTOM_PRICE_MINOR)}. לגישה חינם יש להשתמש במנוי ניסיון.`,
      };
    }
    customPriceMinor = minor;
  }

  await prisma.user.update({
    where: { id: owner.id },
    data: { customPriceMinor },
  });

  // Apply the new amount to her live billing row. Without a plan there is
  // nothing to bill yet — the price simply waits for her next checkout.
  let billingReauthRequired = false;
  let newPriceMinor: number | null = null;
  if (owner.plan) {
    newPriceMinor = effectivePriceMinor(customPriceMinor);
    billingReauthRequired = await syncSubscriptionBilling(
      owner.id,
      owner.plan,
      newPriceMinor,
      { comped: false },
    );
  }

  await logActivity({
    businessId,
    category: "subscription",
    action: customPriceMinor ? "admin.custom_price_set" : "admin.custom_price_cleared",
    summary: customPriceMinor
      ? `מנהל קבע ל${owner.name ?? owner.email} מחיר חודשי של ${shekels(customPriceMinor)}`
      : `מנהל ביטל את המחיר המותאם של ${owner.name ?? owner.email} (חזרה למחיר המחירון)`,
    actorType: "admin",
    metadata: { targetUserId: owner.id, customPriceMinor },
  });

  if (businessId) revalidatePath(`/admin/businesses/${businessId}`);
  revalidatePath("/admin/accounts");
  revalidatePath("/admin");
  revalidatePath("/admin/subscriptions");

  const base = customPriceMinor
    ? `החשבון החודשי הקבוע של בעלת העסק עודכן ל־${shekels(customPriceMinor)}.`
    : newPriceMinor !== null
      ? `המחיר המותאם בוטל. החיוב החודשי חזר למחיר המחירון (${shekels(newPriceMinor)}).`
      : "המחיר המותאם בוטל. החיוב יחזור למחיר המחירון.";
  const message = billingReauthRequired
    ? `${base} הוראת הקבע הישנה בוטלה כדי לא לחייב בסכום שגוי — בעלת העסק תתבקש לאשר ` +
      `מחדש את אמצעי התשלום בסכום החדש בעמוד ההגדרות שלה, ואז החיוב יתחדש אוטומטית. ` +
      `הגישה נשמרת בינתיים.`
    : owner.plan
      ? base
      : `${base} היא עדיין ללא תוכנית פעילה — הסכום יחול בתשלום הראשון שלה.`;

  return { success: true, message };
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
    data: {
      passwordHash: await hashPassword(plain),
      // Revoke every session issued before now. A password reset is almost
      // always a response to a compromised account, and without this it changed
      // nothing for the intruder: sessions are JWTs, so the token they already
      // hold stays valid for its full lifetime. Resetting the password locked
      // out the owner and left the attacker signed in.
      sessionsValidFrom: new Date(),
    },
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
