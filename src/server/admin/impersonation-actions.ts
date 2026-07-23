"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { requirePlatformAdmin } from "@/server/admin/auth";
import { logActivity } from "@/server/activity/log";
import {
  encodeImpersonation,
  readImpersonationCookie,
  IMPERSONATION_COOKIE,
  IMPERSONATION_MAX_AGE,
} from "@/server/admin/impersonation";

/**
 * Begin impersonating a business owner. Admin-only. Sets the signed cookie and
 * drops the admin into the app AS that owner (see server/admin/impersonation.ts).
 * Guards: the target must exist, must not be a platform admin, and must not be
 * the admin themselves.
 */
export async function startImpersonationAction(targetUserId: string): Promise<void> {
  await requirePlatformAdmin();
  const admin = await getCurrentUser();
  if (!admin) redirect("/login");

  if (targetUserId === admin.id) {
    // Nothing to do — can't impersonate yourself.
    redirect(`/admin/businesses`);
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      memberships: {
        where: { role: "owner" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { businessId: true },
      },
    },
  });

  // Never allow impersonating another admin — protects privileged accounts.
  if (!target || target.isAdmin) redirect("/admin/businesses");

  const businessId = target.memberships[0]?.businessId ?? null;

  const store = await cookies();
  store.set(
    IMPERSONATION_COOKIE,
    encodeImpersonation({
      adminId: admin.id,
      targetUserId: target.id,
      businessId,
      startedAt: Date.now(),
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: IMPERSONATION_MAX_AGE,
    },
  );

  await logActivity({
    businessId,
    category: "admin",
    action: "admin.impersonate_start",
    summary: `מנהל התחבר כ${target.name ?? target.email}`,
    userId: admin.id,
    actorType: "admin",
    metadata: { targetUserId: target.id },
  });

  redirect("/dashboard");
}

/**
 * Stop impersonating and restore the admin session. Authorized purely by the
 * signed cookie (the live session, currently rendering as the owner, is not
 * treated as admin) — clearing it simply reasserts the untouched admin session.
 */
export async function stopImpersonationAction(): Promise<void> {
  const imp = await readImpersonationCookie();

  const store = await cookies();
  store.delete(IMPERSONATION_COOKIE);

  if (imp) {
    await logActivity({
      businessId: imp.businessId,
      category: "admin",
      action: "admin.impersonate_stop",
      summary: "מנהל סיים התחברות כבעלת העסק",
      userId: imp.adminId,
      actorType: "admin",
      metadata: { targetUserId: imp.targetUserId },
    });
  }

  redirect(imp?.businessId ? `/admin/businesses/${imp.businessId}` : "/admin");
}
