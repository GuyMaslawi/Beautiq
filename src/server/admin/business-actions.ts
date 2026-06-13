"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requirePlatformAdmin } from "./auth";
import { getCurrentUser } from "@/server/auth/session";

// ---------------------------------------------------------------------------
// Admin business / user deletion — platform-admin only.
//
// Hard delete: every Business child relation in the schema is `onDelete:
// Cascade`, so deleting the Business removes its clients, bookings, services,
// availability, payments, message templates, automations, WhatsApp connection,
// subscription, memberships (BusinessUser) and everything else in one cascade.
//
// The owner User row is NEVER removed by the cascade (a User is not owned by a
// Business). It is only deleted when the admin explicitly asks AND it is safe:
//   - the user belongs ONLY to this business (no other memberships)
//   - the user is not a platform admin
//   - the user is not the admin performing the action (no self-delete)
// ---------------------------------------------------------------------------

export interface AdminDeleteBusinessResult {
  success?: boolean;
  error?: string;
  /** Whether the owner user account was also deleted. */
  ownerUserDeleted?: boolean;
}

export async function adminDeleteBusinessAction(
  businessId: string,
  confirmation: string,
  deleteOwnerUser: boolean,
): Promise<AdminDeleteBusinessResult> {
  // Server-side authorization — never trust the client-side role check.
  await requirePlatformAdmin();

  const admin = await getCurrentUser();
  if (!admin) {
    return { error: "אין הרשאה לפעולה זו" };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      slug: true,
      members: {
        where: { role: "owner" },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, email: true, isAdmin: true } } },
      },
    },
  });

  if (!business) {
    return { error: "העסק לא נמצא" };
  }

  // Typed confirmation must match the business name or its slug exactly.
  const typed = confirmation.trim();
  if (typed.length === 0 || (typed !== business.name && typed !== business.slug)) {
    return { error: "הטקסט שהוקלד אינו תואם לשם העסק" };
  }

  // Decide — before deleting anything — which owner users may be removed.
  const ownerUserIdsToDelete: string[] = [];
  if (deleteOwnerUser) {
    for (const member of business.members) {
      const owner = member.user;
      if (owner.isAdmin) continue; // never delete a platform admin
      if (owner.id === admin.id) continue; // never delete self
      const membershipCount = await prisma.businessUser.count({
        where: { userId: owner.id },
      });
      // Only safe to delete the user when this is their ONLY business.
      if (membershipCount === 1) {
        ownerUserIdsToDelete.push(owner.id);
      }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Deleting the business cascades to all business-owned records and to the
      // BusinessUser membership rows.
      await tx.business.delete({ where: { id: businessId } });

      if (ownerUserIdsToDelete.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: ownerUserIdsToDelete } } });
      }
    });
  } catch {
    // Transaction rolled back — nothing was partially deleted.
    return { error: "המחיקה נכשלה. נסו שוב או פנו לתמיכה." };
  }

  revalidatePath("/admin/businesses");
  revalidatePath("/admin/clients");
  revalidatePath("/admin");

  return { success: true, ownerUserDeleted: ownerUserIdsToDelete.length > 0 };
}
