"use server";

import { revalidatePath } from "next/cache";
import { Prisma, BusinessUserRole } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { getCurrentBusiness, requireCurrentUser } from "@/server/auth/session";
import { slugify, SLUG_MAX_LENGTH } from "@/lib/slug";
import { ONBOARDING } from "@/lib/constants/he";
import { ensureDefaultAutomationSettings } from "@/server/automations/defaults";

/**
 * Business creation (see CLAUDE.md §9–10).
 *
 * The user only provides a business name. The slug is generated automatically
 * from the name server-side (or falls back to a random identifier for Hebrew
 * names that produce no ASCII characters). The owner is derived from the
 * authenticated session via BusinessUser — never from client input — and the
 * business is created together with its owner membership and a default
 * cancellation policy in a single transaction.
 */

export interface BusinessStepState {
  errors?: { name?: string };
  formError?: string;
  /** Set to true when the business was successfully created. The client uses
   *  this signal to call router.refresh() and re-render the dashboard in
   *  State B — because redirecting to the same /dashboard URL does not trigger
   *  a fresh RSC fetch in the Next.js App Router. */
  created?: boolean;
}

/**
 * Generates a unique slug for the given business name. Tries the slugified
 * name first; falls back to a short random string for Hebrew-only names.
 * Appends an incrementing suffix if the candidate is already taken.
 */
async function generateUniqueSlug(name: string): Promise<string> {
  const fromName = slugify(name);
  const base =
    fromName.length >= 3
      ? fromName.slice(0, SLUG_MAX_LENGTH - 4) // leave room for "-99" suffix
      : `bizz-${Math.random().toString(36).slice(2, 8)}`;

  let candidate = base;
  for (let i = 1; i <= 99; i++) {
    const exists = await prisma.business.findUnique({
      where: { slug: candidate },
    });
    if (!exists) return candidate;
    candidate = `${base}-${i}`;
  }
  // Extreme fallback — essentially unique via timestamp
  return `bizz-${Date.now().toString(36)}`;
}

export async function createBusinessAction(
  _prevState: BusinessStepState,
  formData: FormData,
): Promise<BusinessStepState> {
  const user = await requireCurrentUser();

  // V1 assumes one business per user. If one already exists, signal success so
  // the client refreshes into State B (the dashboard view).
  const existing = await getCurrentBusiness();
  if (existing) return { created: true };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { errors: { name: ONBOARDING.errors.nameRequired } };

  const slug = await generateUniqueSlug(name);

  let business: { id: string };
  try {
    business = await prisma.business.create({
      data: {
        name,
        slug,
        // Link the creator as the owner (CLAUDE.md §10) and seed a default
        // cancellation policy (CLAUDE.md §13) so the business is usable at once.
        members: { create: { userId: user.id, role: BusinessUserRole.owner } },
        cancellationPolicy: { create: {} },
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Rare race condition — retry with a fresh random slug next request.
      return { formError: ONBOARDING.errors.generic };
    }
    return { formError: ONBOARDING.errors.generic };
  }

  // Allura's managed WhatsApp notifications are on by default — seed the core
  // operational automations (booking confirmation, reminder, review). Best-effort:
  // a seeding failure must never block business creation; the dashboard backfills.
  try {
    await ensureDefaultAutomationSettings(business.id);
  } catch (err) {
    console.error("[createBusinessAction] failed to seed default automations:", err);
  }

  revalidatePath("/dashboard");
  return { created: true };
}
