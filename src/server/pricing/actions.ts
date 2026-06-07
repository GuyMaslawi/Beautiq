"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";
import { PRICING } from "@/lib/constants/he";

export interface MarketRangeFormState {
  success?: boolean;
  formError?: string;
  fieldErrors?: Partial<Record<"min" | "avg" | "max", string>>;
}

function parseOptionalDecimal(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed);
  return isNaN(n) || n < 0 ? undefined as unknown as null : n;
}

export async function saveMarketRangeAction(
  serviceId: string,
  _prevState: MarketRangeFormState,
  formData: FormData,
): Promise<MarketRangeFormState> {
  const tenant = await requireTenant();

  const rawMin = String(formData.get("marketMinPrice") ?? "");
  const rawAvg = String(formData.get("marketAveragePrice") ?? "");
  const rawMax = String(formData.get("marketMaxPrice") ?? "");

  const minVal = parseOptionalDecimal(rawMin);
  const avgVal = parseOptionalDecimal(rawAvg);
  const maxVal = parseOptionalDecimal(rawMax);

  // Validate individual fields
  const fieldErrors: MarketRangeFormState["fieldErrors"] = {};
  if (rawMin.trim() && minVal === null) fieldErrors.min = PRICING.errors.minInvalid;
  if (rawAvg.trim() && avgVal === null) fieldErrors.avg = PRICING.errors.avgInvalid;
  if (rawMax.trim() && maxVal === null) fieldErrors.max = PRICING.errors.maxInvalid;

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  // Cross-field validation
  if (minVal !== null && maxVal !== null && minVal > maxVal) {
    return { formError: PRICING.errors.rangeInvalid };
  }
  if (avgVal !== null) {
    if (minVal !== null && avgVal < minVal) {
      return { formError: PRICING.errors.avgOutOfRange };
    }
    if (maxVal !== null && avgVal > maxVal) {
      return { formError: PRICING.errors.avgOutOfRange };
    }
  }

  try {
    await prisma.service.updateMany({
      where: { id: serviceId, businessId: tenant.businessId },
      data: {
        marketMinPrice: minVal !== null ? new Prisma.Decimal(minVal) : null,
        marketAveragePrice: avgVal !== null ? new Prisma.Decimal(avgVal) : null,
        marketMaxPrice: maxVal !== null ? new Prisma.Decimal(maxVal) : null,
      },
    });
  } catch {
    return { formError: PRICING.errors.generic };
  }

  revalidatePath("/pricing");
  revalidatePath("/dashboard");
  return { success: true };
}
