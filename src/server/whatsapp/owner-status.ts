/**
 * Owner-facing WhatsApp status aggregator.
 *
 * Combines connection readiness with per-automation template status and maps
 * everything to owner-friendly Hebrew labels. The owner never sees template
 * names, WABA ids, phone number ids, or tokens.
 */

import { prisma } from "@/server/db/prisma";
import { getWhatsAppReadiness, type WhatsAppReadiness } from "@/server/whatsapp/resolver";
import { DEFAULT_TEMPLATES } from "@/lib/whatsapp/default-templates";
import type { AutomationType } from "@prisma/client";

/** Owner-facing per-automation readiness label (Part 4). */
export type AutomationTemplateLabel =
  | "מוכן לשליחה"
  | "ממתין לאישור תבנית"
  | "חסרה תבנית"
  | "התבנית נדחתה"
  | "WhatsApp לא מחובר";

export interface AutomationTemplateStatus {
  type: AutomationType;
  /** Owner-friendly automation name. */
  label: string;
  ownerLabel: AutomationTemplateLabel;
  /** True only when this automation can actually send. */
  ready: boolean;
  /** Admin-only: the technical template name. */
  templateName?: string | null;
  /** Admin-only: raw template status. */
  templateStatus?: string | null;
}

export interface OwnerWhatsAppStatus {
  connection: WhatsAppReadiness;
  automations: AutomationTemplateStatus[];
  /** True when at least one automation is fully ready to send. */
  anyReady: boolean;
}

export async function getOwnerWhatsAppStatus(
  businessId: string,
): Promise<OwnerWhatsAppStatus> {
  const [connection, settings] = await Promise.all([
    getWhatsAppReadiness(businessId),
    prisma.automationSetting.findMany({
      where: { businessId },
      select: { type: true, templateName: true, templateStatus: true },
    }),
  ]);

  const byType = new Map(settings.map((s) => [s.type, s]));
  const connected = connection.state === "active";

  const automations: AutomationTemplateStatus[] = DEFAULT_TEMPLATES.map((tpl) => {
    const setting = byType.get(tpl.automationType);
    let ownerLabel: AutomationTemplateLabel;
    let ready = false;

    if (!connected) {
      ownerLabel = "WhatsApp לא מחובר";
    } else if (!setting?.templateName) {
      ownerLabel = "חסרה תבנית";
    } else if (setting.templateStatus === "approved") {
      ownerLabel = "מוכן לשליחה";
      ready = true;
    } else if (setting.templateStatus === "rejected") {
      ownerLabel = "התבנית נדחתה";
    } else if (setting.templateStatus === "pending") {
      ownerLabel = "ממתין לאישור תבנית";
    } else {
      // unknown / not yet synced — template exists but status not confirmed.
      ownerLabel = "ממתין לאישור תבנית";
    }

    return {
      type: tpl.automationType,
      label: tpl.label,
      ownerLabel,
      ready,
      templateName: setting?.templateName ?? null,
      templateStatus: setting?.templateStatus ?? null,
    };
  });

  return {
    connection,
    automations,
    anyReady: automations.some((a) => a.ready),
  };
}
