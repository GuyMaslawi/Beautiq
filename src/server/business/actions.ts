"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, BusinessUserRole } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { getCurrentBusiness, requireCurrentUser } from "@/server/auth/session";
import { isValidSlug } from "@/lib/slug";
import { ONBOARDING } from "@/lib/constants/he";

/**
 * Business creation (see CLAUDE.md §9–10).
 *
 * The minimum needed to "enter" Beautiq is a name and a public slug. Everything
 * else is optional and guided from the dashboard checklist later. The owner is
 * derived from the authenticated session via BusinessUser — never from client
 * input — and the business is created together with its owner membership and a
 * default cancellation policy in a single transaction.
 */

export interface BusinessStepState {
  errors?: { name?: string; slug?: string };
  formError?: string;
}

export async function createBusinessAction(
  _prevState: BusinessStepState,
  formData: FormData,
): Promise<BusinessStepState> {
  const user = await requireCurrentUser();

  // V1 assumes one business per user. If one already exists, just land on the
  // dashboard (which now shows the setup checklist) instead of creating another.
  const existing = await getCurrentBusiness();
  if (existing) redirect("/dashboard");

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();

  const errors: { name?: string; slug?: string } = {};
  if (!name) errors.name = ONBOARDING.errors.nameRequired;
  if (!slug) errors.slug = ONBOARDING.errors.slugRequired;
  else if (!isValidSlug(slug)) errors.slug = ONBOARDING.errors.slugInvalid;
  if (Object.keys(errors).length > 0) return { errors };

  const taken = await prisma.business.findUnique({ where: { slug } });
  if (taken) return { errors: { slug: ONBOARDING.errors.slugTaken } };

  try {
    await prisma.business.create({
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
      return { errors: { slug: ONBOARDING.errors.slugTaken } };
    }
    return { formError: ONBOARDING.errors.generic };
  }

  // Stay inside the app — the dashboard now renders the setup checklist (state B).
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
