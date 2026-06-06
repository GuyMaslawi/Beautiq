"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";
import {
  validateWeeklyRules,
  validateException,
  type DayFieldErrors,
  type ExceptionFieldErrors,
} from "@/lib/validation/availability";
import { AVAILABILITY } from "@/lib/constants/he";

// ---------------------------------------------------------------------------
// Weekly availability
// ---------------------------------------------------------------------------

export interface WeeklyFormState {
  dayErrors?: Partial<Record<number, DayFieldErrors>>;
  formError?: string;
  success?: boolean;
}

export async function saveWeeklyAvailabilityAction(
  _prevState: WeeklyFormState,
  formData: FormData,
): Promise<WeeklyFormState> {
  const tenant = await requireTenant();

  const days = Array.from({ length: 7 }, (_, i) => ({
    isOpen: formData.get(`day_${i}_open`) === "true",
    startTime: String(formData.get(`day_${i}_start`) ?? ""),
    endTime: String(formData.get(`day_${i}_end`) ?? ""),
  }));

  const result = validateWeeklyRules(days);
  if (!result.ok) return { dayErrors: result.dayErrors };

  try {
    await prisma.$transaction(async (tx) => {
      // Replace all rules atomically: delete existing, insert open days only.
      // Closed days simply have no row — cleaner than storing isActive=false.
      await tx.availabilityRule.deleteMany({
        where: { businessId: tenant.businessId },
      });
      if (result.rules.length > 0) {
        await tx.availabilityRule.createMany({
          data: result.rules.map((rule) => ({
            businessId: tenant.businessId,
            weekday: rule.weekday,
            startMinutes: rule.startMinutes,
            endMinutes: rule.endMinutes,
            isActive: true,
          })),
        });
      }
    });
  } catch {
    return { formError: AVAILABILITY.errors.generic };
  }

  revalidatePath("/availability");
  revalidatePath("/dashboard");

  return { success: true };
}

// ---------------------------------------------------------------------------
// Availability exceptions
// ---------------------------------------------------------------------------

export interface ExceptionFormState {
  errors?: ExceptionFieldErrors;
  formError?: string;
  success?: boolean;
  /** Echoed back so the form can restore values after a validation error. */
  values?: { date: string; type: string; startTime: string; endTime: string; reason: string };
}

export async function addExceptionAction(
  _prevState: ExceptionFormState,
  formData: FormData,
): Promise<ExceptionFormState> {
  const tenant = await requireTenant();

  const raw = {
    date: String(formData.get("date") ?? ""),
    type: String(formData.get("type") ?? ""),
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  };

  const result = validateException(raw);
  if (!result.ok) return { errors: result.errors, values: raw };

  const { value } = result;

  try {
    await prisma.availabilityException.create({
      data: {
        businessId: tenant.businessId,
        date: value.date,
        type: value.type,
        startMinutes: value.startMinutes ?? null,
        endMinutes: value.endMinutes ?? null,
        reason: value.reason ?? null,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { errors: { date: AVAILABILITY.errors.dateTaken }, values: raw };
    }
    return { formError: AVAILABILITY.errors.generic, values: raw };
  }

  revalidatePath("/availability");

  return { success: true };
}

export async function deleteExceptionAction(exceptionId: string): Promise<void> {
  const tenant = await requireTenant();
  // deleteMany scopes by businessId — prevents cross-tenant deletion
  await prisma.availabilityException.deleteMany({
    where: { id: exceptionId, businessId: tenant.businessId },
  });
  revalidatePath("/availability");
  revalidatePath("/dashboard");
}
