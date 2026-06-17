/**
 * Owner-facing WhatsApp status aggregator.
 *
 * Combines connection readiness with per-automation template status and maps
 * everything to owner-friendly Hebrew labels. The owner never sees template
 * names, WABA ids, phone number ids, or tokens.
 */

import { prisma } from "@/server/db/prisma";
import { getWhatsAppReadiness, type WhatsAppReadiness } from "@/server/whatsapp/resolver";
import { DEFAULT_TEMPLATES, type TemplateGroup } from "@/lib/whatsapp/default-templates";
import type { AutomationType } from "@prisma/client";

/** Owner-facing per-automation readiness label (Part 4). */
export type AutomationTemplateLabel =
  | "מוכן לשליחה"
  | "ממתין לאישור WhatsApp"
  | "מכינים תבניות הודעה"
  | "נדחתה — פני לתמיכה"
  | "WhatsApp לא מחובר";

export interface AutomationTemplateStatus {
  type: AutomationType;
  /** Owner-friendly automation name. */
  label: string;
  ownerLabel: AutomationTemplateLabel;
  /** Readiness group — operational (core) vs marketing (optional). */
  group: TemplateGroup;
  /** True only when this automation can actually send (template approved). */
  ready: boolean;
  /** True when the template was submitted to Meta (pending or approved). */
  submitted: boolean;
  /** True when this template was rejected by Meta. */
  failed: boolean;
  /** Admin-only: the technical template name. */
  templateName?: string | null;
  /** Admin-only: raw template status. */
  templateStatus?: string | null;
}

/**
 * Owner-facing single setup state — the one plain-Hebrew status the business
 * owner sees at the top of the card. Derived from connection + operational
 * template readiness. The optional marketing template never affects it.
 */
export type OwnerSetupState =
  | "not_connected"
  | "connecting"
  | "needs_confirmation"
  | "preparing"
  | "pending_approval"
  | "ready"
  | "needs_support";

/**
 * Explicit, owner-safe readiness levels (Part 4). Separates connection,
 * confirmation, operational templates, and marketing templates so the UI can
 * prioritise operational readiness and never block reminders on a marketing
 * template failure.
 */
export interface WhatsAppReadinessLevels {
  /** Connection is active (Meta link established). */
  connectionReady: boolean;
  /** Owner has confirmed the connected number (sends are unblocked). */
  numberConfirmed: boolean;
  /** Every operational template is at least submitted (pending or approved). */
  operationalTemplatesReadyOrPending: boolean;
  /** Every marketing template is at least submitted (pending or approved). */
  marketingTemplateReadyOrPending: boolean;
  /** Can actually send operational messages now (connected, confirmed, approved). */
  canSendOperationalMessages: boolean;
  /** Can actually send marketing messages now (connected, confirmed, approved). */
  canSendMarketingMessages: boolean;
}

export interface OwnerWhatsAppStatus {
  connection: WhatsAppReadiness;
  automations: AutomationTemplateStatus[];
  /** Operational (core/transactional) automations only. */
  operational: AutomationTemplateStatus[];
  /** Marketing (optional) automations only. */
  marketing: AutomationTemplateStatus[];
  /** True when at least one automation is fully ready to send. */
  anyReady: boolean;
  /**
   * True when every operational automation is at least submitted (pending/
   * approved) — the core WhatsApp setup is usable regardless of the marketing
   * template's state.
   */
  operationalReady: boolean;
  /** True when every marketing automation is at least submitted. */
  marketingReady: boolean;
  /** True when a marketing automation's template was rejected by Meta. */
  marketingFailed: boolean;
  /** Explicit, owner-safe readiness levels (Part 4). */
  readiness: WhatsAppReadinessLevels;
  /** The single owner-facing setup state shown at the top of the card. */
  ownerSetupState: OwnerSetupState;
  /** Plain-Hebrew label for {@link ownerSetupState}. */
  ownerSetupLabel: string;
}

/** Plain-Hebrew label for each owner setup state. */
const OWNER_SETUP_LABELS: Record<OwnerSetupState, string> = {
  not_connected: "WhatsApp לא מחובר",
  connecting: "בודקים את החיבור",
  needs_confirmation: "נדרש אישור מספר",
  preparing: "מכינים את הודעות WhatsApp",
  pending_approval: "ממתין לאישור WhatsApp",
  ready: "WhatsApp מוכן לשליחה",
  needs_support: "נדרשת בדיקה",
};

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
    let submitted = false;
    let failed = false;

    if (!connected) {
      ownerLabel = "WhatsApp לא מחובר";
    } else if (!setting?.templateName) {
      // Connected but template not created yet — calm "preparing" state, never a warning.
      ownerLabel = "מכינים תבניות הודעה";
    } else if (setting.templateStatus === "approved") {
      ownerLabel = "מוכן לשליחה";
      ready = true;
      submitted = true;
    } else if (setting.templateStatus === "rejected") {
      ownerLabel = "נדחתה — פני לתמיכה";
      failed = true;
    } else if (setting.templateStatus === "pending") {
      ownerLabel = "ממתין לאישור WhatsApp";
      submitted = true;
    } else {
      // unknown / not yet synced — template exists but status not confirmed.
      ownerLabel = "ממתין לאישור WhatsApp";
      submitted = true;
    }

    return {
      type: tpl.automationType,
      label: tpl.label,
      ownerLabel,
      group: tpl.group,
      ready,
      submitted,
      failed,
      templateName: setting?.templateName ?? null,
      templateStatus: setting?.templateStatus ?? null,
    };
  });

  const operational = automations.filter((a) => a.group === "operational");
  const marketing = automations.filter((a) => a.group === "marketing");

  // Operational setup is "ready" (usable) only once connected and every core
  // template is at least submitted — a marketing failure never affects this.
  const operationalReady =
    connected && operational.length > 0 && operational.every((a) => a.submitted);
  const marketingReady =
    connected && marketing.length > 0 && marketing.every((a) => a.submitted);
  const marketingFailed = marketing.some((a) => a.failed);

  const operationalApproved =
    connected && operational.length > 0 && operational.every((a) => a.ready);
  const operationalFailed = operational.some((a) => a.failed);
  const numberConfirmed = connected && !connection.needsNumberConfirmation;

  const readiness: WhatsAppReadinessLevels = {
    connectionReady: connected,
    numberConfirmed,
    operationalTemplatesReadyOrPending: operationalReady,
    marketingTemplateReadyOrPending: marketingReady,
    canSendOperationalMessages: numberConfirmed && operationalApproved,
    canSendMarketingMessages:
      numberConfirmed && marketing.length > 0 && marketing.every((a) => a.ready),
  };

  // Derive the single owner-facing setup state. Operational readiness is
  // prioritised; a marketing-only failure never pushes the owner to "needs_support".
  let ownerSetupState: OwnerSetupState;
  if (!connected) {
    ownerSetupState = connection.state === "pending" ? "connecting" : "not_connected";
  } else if (connection.needsNumberConfirmation) {
    ownerSetupState = "needs_confirmation";
  } else if (operationalFailed) {
    ownerSetupState = "needs_support";
  } else if (operationalApproved) {
    ownerSetupState = "ready";
  } else if (operationalReady) {
    ownerSetupState = "pending_approval";
  } else {
    ownerSetupState = "preparing";
  }

  return {
    connection,
    automations,
    operational,
    marketing,
    anyReady: automations.some((a) => a.ready),
    operationalReady,
    marketingReady,
    marketingFailed,
    readiness,
    ownerSetupState,
    ownerSetupLabel: OWNER_SETUP_LABELS[ownerSetupState],
  };
}
