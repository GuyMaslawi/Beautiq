/**
 * Default automation settings for Allura's managed WhatsApp notifications.
 *
 * In the managed model every business gets the core service notifications
 * enabled automatically — the owner never sets up or connects WhatsApp. These
 * defaults are seeded when a business is created and backfilled lazily for
 * existing businesses.
 *
 * Only OPERATIONAL (transactional) automations are enabled by default:
 *   - booking_confirmation
 *   - morning_reminder (appointment reminder)
 *   - review_request
 *
 * Marketing / win-back is intentionally NOT seeded here — it stays disabled and
 * requires explicit marketing opt-in before it is ever used.
 *
 * The Meta template name/language/status point at Allura's own managed (pre-
 * approved) templates, so real sends are not skipped for a "missing template".
 */

import { prisma } from "@/server/db/prisma";
import type { AutomationType } from "@prisma/client";
import { getDefaultTemplateForType } from "@/lib/whatsapp/default-templates";

interface DefaultAutomationSpec {
  type: AutomationType;
  /** Reminder timing: thresholdDays=1 → remind the evening before. */
  thresholdDays: number;
  sendHour: number;
}

/** Operational automations that are enabled by default for every business. */
const DEFAULT_OPERATIONAL_AUTOMATIONS: DefaultAutomationSpec[] = [
  // Sent immediately when a booking is created/approved — sendHour is unused.
  { type: "booking_confirmation", thresholdDays: 1, sendHour: 10 },
  // Appointment reminder the evening before the appointment.
  { type: "morning_reminder", thresholdDays: 1, sendHour: 18 },
  // Review request ~24h after a completed appointment.
  { type: "review_request", thresholdDays: 1, sendHour: 24 },
];

function buildDefaultData(spec: DefaultAutomationSpec, businessId: string) {
  const tpl = getDefaultTemplateForType(spec.type);
  return {
    businessId,
    type: spec.type,
    enabled: true,
    thresholdDays: spec.thresholdDays,
    sendHour: spec.sendHour,
    // Service notifications require customer consent (collected on the public
    // booking page) and never go to unsubscribed customers.
    requireOptIn: true,
    // Point at Allura's managed, pre-approved template for this type.
    templateName: tpl?.name ?? null,
    templateLanguage: tpl?.language ?? "he",
    templateStatus: tpl ? "approved" : null,
  };
}

/**
 * Idempotently ensure the default operational automations exist and are enabled
 * for a business. Safe to call repeatedly — existing settings are never
 * overwritten (so owner customisations and disabled toggles are preserved).
 */
export async function ensureDefaultAutomationSettings(
  businessId: string,
): Promise<void> {
  const existing = await prisma.automationSetting.findMany({
    where: {
      businessId,
      type: { in: DEFAULT_OPERATIONAL_AUTOMATIONS.map((a) => a.type) },
    },
    select: { type: true },
  });
  const existingTypes = new Set(existing.map((s) => s.type));

  const missing = DEFAULT_OPERATIONAL_AUTOMATIONS.filter(
    (a) => !existingTypes.has(a.type),
  );
  if (missing.length === 0) return;

  await prisma.automationSetting.createMany({
    data: missing.map((spec) => buildDefaultData(spec, businessId)),
    skipDuplicates: true,
  });
}
