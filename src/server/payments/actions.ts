"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";
import { validatePaymentSettings } from "@/lib/validation/payments";
import { PAYMENTS } from "@/lib/constants/he";

export interface PaymentSettingsFormState {
  errors?: Partial<Record<string, string>>;
  formError?: string;
  success?: string;
  values?: Record<string, string>;
}

/**
 * Owner action: save the business payment policy. Scoped to the current
 * tenant — businessId is never accepted from the form. Provider credentials
 * are managed separately and never touched here.
 */
export async function updatePaymentSettingsAction(
  _prevState: PaymentSettingsFormState,
  formData: FormData,
): Promise<PaymentSettingsFormState> {
  const tenant = await requireTenant();

  const raw: Record<string, string> = {
    enabled: String(formData.get("enabled") ?? ""),
    provider: String(formData.get("provider") ?? "mock"),
    requirement: String(formData.get("requirement") ?? "none"),
    depositType: String(formData.get("depositType") ?? "fixed_amount"),
    depositAmount: String(formData.get("depositAmount") ?? ""),
    depositPercentage: String(formData.get("depositPercentage") ?? ""),
    allowPayAtBusiness: String(formData.get("allowPayAtBusiness") ?? ""),
    instructions: String(formData.get("instructions") ?? ""),
  };

  const result = validatePaymentSettings(raw);
  if (!result.ok) return { errors: result.errors, values: raw };

  const { value } = result;

  try {
    await prisma.businessPaymentSettings.upsert({
      where: { businessId: tenant.businessId },
      create: { businessId: tenant.businessId, ...value },
      update: { ...value },
    });
  } catch {
    return { formError: PAYMENTS.errors.generic, values: raw };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: PAYMENTS.settings.success };
}
