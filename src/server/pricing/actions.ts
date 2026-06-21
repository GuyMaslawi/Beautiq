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

/**
 * Parses an optional price field. Returns `null` for an empty field, the parsed
 * number for a valid one, or `"invalid"` for non-numeric / negative input so the
 * caller can surface a field-level error (rather than silently failing later).
 */
function parseOptionalDecimal(raw: string): number | null | "invalid" {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed);
  return isNaN(n) || n < 0 ? "invalid" : n;
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

  const parsedMin = parseOptionalDecimal(rawMin);
  const parsedAvg = parseOptionalDecimal(rawAvg);
  const parsedMax = parseOptionalDecimal(rawMax);

  // Validate individual fields
  const fieldErrors: MarketRangeFormState["fieldErrors"] = {};
  if (parsedMin === "invalid") fieldErrors.min = PRICING.errors.minInvalid;
  if (parsedAvg === "invalid") fieldErrors.avg = PRICING.errors.avgInvalid;
  if (parsedMax === "invalid") fieldErrors.max = PRICING.errors.maxInvalid;

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  // Past the guard, each value is a valid number or null (empty field).
  const minVal = parsedMin as number | null;
  const avgVal = parsedAvg as number | null;
  const maxVal = parsedMax as number | null;

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
