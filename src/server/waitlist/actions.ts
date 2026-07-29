"use server";

import { revalidatePath } from "next/cache";
import type { WaitlistStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";
import { findOrCreateClient } from "@/server/clients/find-or-create";
import { isValidIsraeliPhone } from "@/lib/phone";
import { parseIsraelDateTime, isValidDateStr, isValidTimeStr } from "@/lib/time";
import { WAITLIST } from "@/lib/constants/he";

export interface WaitlistFormState {
  success?: boolean;
  /** Unique per successful submit — lets the form react to a new success. */
  nonce?: string;
  errors?: Partial<Record<string, string>>;
  formError?: string;
  values?: Record<string, string>;
}

/**
 * Add a client to the waitlist. Inputs are intentionally minimal: name + phone
 * (find-or-create), an optional service, and an optional preferred day + time
 * window. A time window is only stored when a preferred date is also given.
 */
export async function createWaitlistEntryAction(
  _prevState: WaitlistFormState,
  formData: FormData,
): Promise<WaitlistFormState> {
  const tenant = await requireTenant();

  const raw = {
    clientName: String(formData.get("clientName") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    serviceId: String(formData.get("serviceId") ?? "").trim(),
    preferredDate: String(formData.get("preferredDate") ?? "").trim(),
    preferredFromTime: String(formData.get("preferredFromTime") ?? "").trim(),
    preferredToTime: String(formData.get("preferredToTime") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };

  const errors: Record<string, string> = {};
  if (!raw.clientName) errors.clientName = WAITLIST.form.errorName;
  if (!isValidIsraeliPhone(raw.phone)) errors.phone = WAITLIST.form.errorPhone;

  // התאריך והשעות מגיעים משדות טופס ונמסרים ישירות ל-parseIsraelDateTime.
  // בלי אימות, ערך כמו "abc" הפיל את הבקשה כולה (RangeError מתוך Intl) לפני
  // שהגיעה בכלל ל-try, וערך כמו "2026-99-99" נשמר כחלון זמן בשנה אחרת לגמרי.
  if (raw.preferredDate && !isValidDateStr(raw.preferredDate)) {
    errors.preferredDate = WAITLIST.form.errorDate;
  }
  if (raw.preferredFromTime && !isValidTimeStr(raw.preferredFromTime)) {
    errors.preferredFromTime = WAITLIST.form.errorTime;
  }
  if (raw.preferredToTime && !isValidTimeStr(raw.preferredToTime)) {
    errors.preferredToTime = WAITLIST.form.errorTime;
  }

  if (Object.keys(errors).length > 0) return { errors, values: raw };

  // Verify the optional service belongs to this business (tenant safety).
  let serviceId: string | null = null;
  if (raw.serviceId) {
    const service = await prisma.service.findFirst({
      where: { id: raw.serviceId, businessId: tenant.businessId },
      select: { id: true },
    });
    serviceId = service?.id ?? null;
  }

  // Build the preferred window only when a date is supplied.
  let preferredFrom: Date | null = null;
  let preferredTo: Date | null = null;
  if (raw.preferredDate) {
    preferredFrom = parseIsraelDateTime(
      raw.preferredDate,
      raw.preferredFromTime || "00:00",
    );
    preferredTo = parseIsraelDateTime(
      raw.preferredDate,
      raw.preferredToTime || "23:59",
    );
  }

  try {
    const client = await findOrCreateClient(tenant, {
      fullName: raw.clientName,
      phone: raw.phone,
    });

    const created = await prisma.waitlistEntry.create({
      data: {
        businessId: tenant.businessId,
        clientId: client.id,
        serviceId,
        preferredFrom,
        preferredTo,
        notes: raw.notes || null,
        status: "active",
      },
      select: { id: true },
    });

    revalidatePath("/waitlist");
    revalidatePath("/dashboard");
    return { success: true, nonce: created.id };
  } catch {
    return { formError: WAITLIST.form.errorGeneric, values: raw };
  }
}

/** הסטטוסים שמותר לעבור אליהם — רשימת היתר שנאכפת בזמן ריצה. */
const ALLOWED_WAITLIST_STATUSES: readonly WaitlistStatus[] = [
  "active",
  "notified",
  "booked",
  "cancelled",
];

/**
 * Move a waitlist entry to a new status (notified / booked / cancelled). Scoped
 * by businessId so a cross-tenant id matches no rows.
 */
export async function setWaitlistStatusAction(
  entryId: string,
  status: WaitlistStatus,
): Promise<void> {
  const tenant = await requireTenant();

  // `status: WaitlistStatus` הוא הבטחה של TypeScript בלבד — הפעולה הזו היא
  // נקודת קצה HTTP שכל אחת יכולה לקרוא לה עם מחרוזת שרירותית. בלי הרשימה כאן
  // ערך לא חוקי הגיע ל-Prisma, נזרק כחריגה לא מטופלת והפיל את הבקשה.
  if (!ALLOWED_WAITLIST_STATUSES.includes(status)) return;

  await prisma.waitlistEntry.updateMany({
    where: { id: entryId, businessId: tenant.businessId },
    data: { status },
  });
  revalidatePath("/waitlist");
  revalidatePath("/dashboard");
}
