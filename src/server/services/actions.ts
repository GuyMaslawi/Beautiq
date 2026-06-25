"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";
import { getService } from "@/server/services/queries";
import { validateService } from "@/lib/validation/service";
import { SERVICES } from "@/lib/constants/he";

export interface ServiceFormState {
  errors?: Partial<Record<string, string>>;
  formError?: string;
  /** Raw field values echoed back so the form can restore them after errors. */
  values?: Record<string, string>;
}

function extractRaw(formData: FormData): Record<string, string> {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    durationMinutes: String(formData.get("durationMinutes") ?? ""),
    price: String(formData.get("price") ?? ""),
    bufferBeforeMinutes: String(formData.get("bufferBeforeMinutes") ?? ""),
    bufferAfterMinutes: String(formData.get("bufferAfterMinutes") ?? ""),
    categoryKey: String(formData.get("categoryKey") ?? ""),
    isActive: String(formData.get("isActive") ?? ""),
  };
}

export async function createServiceAction(
  _prevState: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const tenant = await requireTenant();
  const raw = extractRaw(formData);
  const result = validateService(raw);

  if (!result.ok) return { errors: result.errors, values: raw };

  const { value } = result;

  try {
    await prisma.service.create({
      data: {
        businessId: tenant.businessId,
        name: value.name,
        description: value.description ?? null,
        durationMinutes: value.durationMinutes,
        price: new Prisma.Decimal(value.price),
        bufferBeforeMinutes: value.bufferBeforeMinutes,
        bufferAfterMinutes: value.bufferAfterMinutes,
        categoryKey: value.categoryKey ?? null,
        isActive: true,
      },
    });
  } catch {
    return { formError: SERVICES.errors.generic, values: raw };
  }

  revalidatePath("/services");
  revalidatePath("/dashboard");
  redirect("/services");
}

export async function updateServiceAction(
  serviceId: string,
  _prevState: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const tenant = await requireTenant();
  const existing = await getService(tenant, serviceId);
  if (!existing) return { formError: SERVICES.errors.notFound };

  const raw = extractRaw(formData);
  const result = validateService(raw);

  if (!result.ok) return { errors: result.errors, values: raw };

  const { value } = result;
  // isActive: the checkbox sends "true" when checked, nothing when unchecked
  const isActive = raw.isActive === "true";

  try {
    // updateMany scopes by businessId so the write can never touch another
    // tenant's service, even though getService() above already verified
    // ownership (CLAUDE.md §10: never mutate business data by record id alone).
    const { count } = await prisma.service.updateMany({
      where: { id: serviceId, businessId: tenant.businessId },
      data: {
        name: value.name,
        description: value.description ?? null,
        durationMinutes: value.durationMinutes,
        price: new Prisma.Decimal(value.price),
        bufferBeforeMinutes: value.bufferBeforeMinutes,
        bufferAfterMinutes: value.bufferAfterMinutes,
        categoryKey: value.categoryKey ?? null,
        isActive,
      },
    });
    if (count === 0) return { formError: SERVICES.errors.notFound };
  } catch {
    return { formError: SERVICES.errors.generic, values: raw };
  }

  revalidatePath("/services");
  revalidatePath(`/services/${serviceId}`);
  revalidatePath("/dashboard");
  redirect("/services");
}

export async function toggleServiceActiveAction(
  serviceId: string,
  isActive: boolean,
): Promise<{ success: boolean }> {
  try {
    const tenant = await requireTenant();
    // updateMany scopes by businessId — safe, never touches another business's data
    await prisma.service.updateMany({
      where: { id: serviceId, businessId: tenant.businessId },
      data: { isActive },
    });
    const business = await prisma.business.findUnique({
      where: { id: tenant.businessId },
      select: { slug: true },
    });
    revalidatePath("/services");
    revalidatePath("/dashboard");
    if (business?.slug) revalidatePath(`/b/${business.slug}`);
    return { success: true };
  } catch {
    return { success: false };
  }
}
