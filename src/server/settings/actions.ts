"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";
import { logActivity } from "@/server/activity/log";
import { validateBusinessDetails } from "@/lib/validation/settings";
import { SETTINGS } from "@/lib/constants/he";

// ---------------------------------------------------------------------------
// Business details
// ---------------------------------------------------------------------------

export interface BusinessDetailsFormState {
  errors?: Partial<Record<string, string>>;
  formError?: string;
  success?: string;
  values?: Record<string, string>;
}

export async function updateBusinessDetailsAction(
  _prevState: BusinessDetailsFormState,
  formData: FormData,
): Promise<BusinessDetailsFormState> {
  const tenant = await requireTenant();

  const raw: Record<string, string> = {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    city: String(formData.get("city") ?? ""),
    description: String(formData.get("description") ?? ""),
    addressNote: String(formData.get("addressNote") ?? ""),
  };

  const result = validateBusinessDetails(raw);
  if (!result.ok) return { errors: result.errors, values: raw };

  const { value } = result;

  try {
    await prisma.business.update({
      where: { id: tenant.businessId },
      data: {
        name: value.name,
        phone: value.phone ?? null,
        city: value.city ?? null,
        description: value.description ?? null,
        addressNote: value.addressNote ?? null,
      },
    });
  } catch {
    return { formError: SETTINGS.errors.generic, values: raw };
  }

  await logActivity({
    businessId: tenant.businessId,
    category: "settings",
    action: "settings.business_details",
    summary: "עודכנו פרטי העסק",
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: SETTINGS.businessDetails.success };
}

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------

/**
 * Instant single-toggle save — flipping the switch persists immediately,
 * no separate save button. Returns an error so the client can revert on failure.
 */
export async function setEmailNotificationsAction(
  enabled: boolean,
): Promise<{ error?: string }> {
  const tenant = await requireTenant();

  try {
    await prisma.business.update({
      where: { id: tenant.businessId },
      data: { emailNotificationsEnabled: enabled },
    });
  } catch {
    return { error: SETTINGS.errors.generic };
  }

  revalidatePath("/settings");
  return {};
}

// ---------------------------------------------------------------------------
// Business categories
// ---------------------------------------------------------------------------

export interface CategoriesFormState {
  formError?: string;
  success?: string;
}

export async function updateBusinessCategoriesAction(
  _prevState: CategoriesFormState,
  formData: FormData,
): Promise<CategoriesFormState> {
  const tenant = await requireTenant();

  const selectedIds = formData.getAll("categoryIds").map(String);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.businessCategoryOnBusiness.deleteMany({
        where: { businessId: tenant.businessId },
      });

      if (selectedIds.length > 0) {
        const categories = await tx.businessCategory.findMany({
          where: { id: { in: selectedIds } },
          select: { id: true },
        });
        const validIds = categories.map((c) => c.id);

        await tx.businessCategoryOnBusiness.createMany({
          data: validIds.map((categoryId) => ({
            businessId: tenant.businessId,
            categoryId,
          })),
        });
      }
    });
  } catch {
    return { formError: SETTINGS.errors.generic };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: SETTINGS.categories.success };
}
