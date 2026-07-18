/**
 * Resolves the approved MARKETING template used for a bulk campaign.
 *
 * We reuse the existing registry + per-business AutomationSetting so there is a
 * single source of truth for template name / language / approval status. The
 * fixed template body is NEVER owner-editable; the owner may only supply values
 * for the variables the approved template actually exposes (registry-driven).
 *
 * Today the approved marketing template (win_back_offer_he) is a neutral 2-var
 * check-in (client first name + business name) with no free offer text. If a
 * richer approved marketing template is added to the registry later, its extra
 * variables surface automatically — no code change here.
 */

import { prisma } from "@/server/db/prisma";
import { MARKETING_TEMPLATES } from "@/lib/whatsapp/default-templates";
import {
  resolveWhatsAppConnectionForBusiness,
} from "@/server/whatsapp/resolver";

export type CampaignTemplateStatus = "approved" | "pending" | "rejected" | "unknown";

export interface CampaignTemplateInfo {
  name: string;
  language: string;
  category: "MARKETING";
  label: string;
  /** Registry variable names in positional order (e.g. ["clientName","businessName"]). */
  variableNames: string[];
  /** Registry template body with {{n}} placeholders (for building previews). */
  body: string;
  example: string[];
  status: CampaignTemplateStatus;
  /** True when the campaign may actually send (approved, or Allura-managed central template). */
  available: boolean;
  /** True when the business sends through Allura's managed sender. */
  isAlluraManaged: boolean;
}

/** First name only — Meta {{1}} for the neutral marketing template. */
export function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
}

/**
 * Resolve the marketing campaign template for a business. Does NOT hit Meta —
 * approval status is read from the per-business AutomationSetting (kept fresh by
 * the existing template sync). For Allura-managed businesses the central
 * template is pre-approved, so it is treated as available.
 */
export async function getMarketingCampaignTemplate(
  businessId: string,
): Promise<CampaignTemplateInfo> {
  const registry = MARKETING_TEMPLATES[0];

  const [setting, resolved] = await Promise.all([
    prisma.automationSetting.findUnique({
      where: { businessId_type: { businessId, type: "win_back" } },
      select: { templateName: true, templateLanguage: true, templateStatus: true },
    }),
    resolveWhatsAppConnectionForBusiness(businessId),
  ]);

  const isAlluraManaged = resolved.isAlluraManaged;
  // Dev / local mode: real sending is off, so the resolver hands back the safe
  // dev-mock provider. The processor fully supports this path (every recipient is
  // recorded as a clearly-labeled "dev mode — not actually sent" skip), so the
  // whole flow must be exercisable end-to-end. Treat it as available so the UI
  // does not dead-end at the content step in dev/staging.
  const isDevMock = resolved.provider.name === "dev_mock";

  const name = setting?.templateName ?? registry.name;
  const language = setting?.templateLanguage ?? registry.language;

  const rawStatus = (setting?.templateStatus ?? "").toLowerCase();
  const status: CampaignTemplateStatus =
    rawStatus === "approved"
      ? "approved"
      : rawStatus === "pending"
        ? "pending"
        : rawStatus === "rejected"
          ? "rejected"
          : isAlluraManaged || isDevMock
            ? "approved" // central managed template (or dev-mock) is pre-approved
            : "unknown";

  // A marketing blast requires an approved template. Allura-managed central
  // templates are pre-approved; the dev-mock path is always sendable (no real
  // send happens); otherwise the per-business status must be approved.
  const available =
    isDevMock || (resolved.mode !== "disconnected" && (status === "approved" || isAlluraManaged));

  return {
    name,
    language,
    category: "MARKETING",
    label: registry.label,
    variableNames: registry.variables,
    body: registry.body,
    example: registry.example,
    status,
    available,
    isAlluraManaged,
  };
}

/**
 * Build the positional template variables ("1","2",…) for a recipient, driven by
 * the registry variable list. Unknown/rich variables (offer, url) are filled from
 * the owner-supplied payload when the template exposes them; the neutral template
 * only uses clientName + businessName.
 */
export function buildCampaignVariables(
  template: CampaignTemplateInfo,
  args: {
    clientFullName: string;
    businessName: string;
    payload?: Record<string, string> | null;
  },
): Record<string, string> {
  const vars: Record<string, string> = {};
  template.variableNames.forEach((varName, index) => {
    const key = String(index + 1);
    switch (varName) {
      case "clientName":
        vars[key] = firstName(args.clientFullName);
        break;
      case "businessName":
        vars[key] = args.businessName;
        break;
      default:
        // Owner-supplied variable value (e.g. offer text) — only used when the
        // approved template actually declares this variable.
        vars[key] = args.payload?.[varName]?.trim() ?? "";
    }
  });
  return vars;
}

/** Renders a preview string for one recipient from the registry body + variables. */
export function renderCampaignPreview(
  template: CampaignTemplateInfo,
  vars: Record<string, string>,
): string {
  return template.body.replace(/\{\{(\d+)\}\}/g, (_m, n: string) => vars[n] ?? `{{${n}}}`);
}
