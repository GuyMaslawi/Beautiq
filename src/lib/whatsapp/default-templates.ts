/**
 * Default WhatsApp message templates for Allura.
 *
 * These are the 4 templates every connected business needs. After Embedded
 * Signup, Allura can create them in the business's WABA via the Meta Message
 * Templates API ("יצירת תבניות WhatsApp"), or sync existing ones by name
 * ("סנכרון תבניות").
 *
 * Each template maps to the AutomationType whose AutomationSetting stores its
 * templateName / templateLanguage / templateStatus.
 *
 * Hebrew bodies use Meta's positional {{1}}..{{4}} variables. The `example`
 * values are required by Meta for template approval.
 */

import type { AutomationType } from "@prisma/client";
import { APP_URL } from "@/lib/config";

export type MetaTemplateCategory = "UTILITY" | "MARKETING";

/**
 * Readiness group. Operational/transactional templates (UTILITY) are the core of
 * WhatsApp setup — booking confirmation, appointment reminder, review request.
 * The single marketing template (win-back) is OPTIONAL: Meta reviews MARKETING
 * templates more strictly, so a marketing failure must never block the core
 * operational setup. See getOwnerWhatsAppStatus / createDefaultTemplatesForBusiness.
 */
export type TemplateGroup = "operational" | "marketing";

/**
 * Example review link sent to Meta for approval. Must be a non-empty absolute
 * URL even when APP_URL is unset in the environment, otherwise Meta rejects the
 * example value.
 */
const REVIEW_EXAMPLE_LINK = `${APP_URL || "https://allura.app"}/b/studio#reviews`;

export interface DefaultTemplate {
  /** Meta template name (lowercase, snake_case). */
  name: string;
  /** Owner-friendly Hebrew label — never shows the technical name. */
  label: string;
  language: string;
  category: MetaTemplateCategory;
  /** Readiness group — operational (core) vs marketing (optional). */
  group: TemplateGroup;
  /** Body text with Meta {{n}} placeholders. */
  body: string;
  /** Example values for each {{n}} variable, in order (for Meta approval). */
  example: string[];
  /** Human description of each variable, in order — for admin/diagnostics. */
  variables: string[];
  /** Which automation this template powers. */
  automationType: AutomationType;
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: "booking_confirmation_he",
    label: "אישור תור",
    language: "he",
    category: "UTILITY",
    group: "operational",
    // Allura-managed (pre-approved) template. Sent from Allura's managed WhatsApp
    // sender; the body itself states it is sent by Allura on behalf of the
    // business ({{2}} = businessName). BODY-only, clearly transactional. The body
    // must not end with a variable (Meta rejects trailing variables), so it ends
    // with the "נשלח באמצעות Allura" line.
    body:
      "היי {{1}} ✨\nהתור שלך אצל {{2}} נקבע בהצלחה:\n{{3}}\n{{4}} בשעה {{5}}\n\nנשלח באמצעות Allura",
    example: ["נועה", "סטודיו ביוטי", "לק ג'ל", "שלישי 18.6", "10:30"],
    variables: ["clientName", "businessName", "serviceName", "bookingDate", "bookingTime"],
    automationType: "booking_confirmation",
  },
  {
    name: "appointment_reminder_he",
    label: "תזכורת לתור",
    language: "he",
    category: "UTILITY",
    group: "operational",
    // Allura-managed reminder. {{2}} = businessName so the customer sees the
    // reminder is from Allura on behalf of their business. Ends with a closing
    // line (not a variable).
    body:
      "היי {{1}},\nתזכורת מ־Allura בשם {{2}} ✨\nיש לך תור ל{{3}} ב־{{4}} בשעה {{5}}.\nנתראה בקרוב 🙂",
    example: ["נועה", "סטודיו ביוטי", "לק ג'ל", "שלישי 18.6", "10:30"],
    variables: ["clientName", "businessName", "serviceName", "bookingDate", "bookingTime"],
    automationType: "morning_reminder",
  },
  {
    name: "review_request_he",
    label: "בקשת ביקורת",
    language: "he",
    category: "UTILITY",
    group: "operational",
    // Variables must appear in order {{1}}..{{3}}; the body must not end with a
    // variable, so it ends with the "נשלח באמצעות Allura" line.
    body:
      "היי {{1}},\nמקווים שנהנית מהתור אצל {{2}} ✨\nנשמח אם תשאירי ביקורת קצרה:\n{{3}}\n\nנשלח באמצעות Allura",
    example: ["דנה", "סטודיו ביוטי", REVIEW_EXAMPLE_LINK],
    variables: ["clientName", "businessName", "reviewLink"],
    automationType: "review_request",
  },
  {
    // Optional MARKETING template — kept deliberately NEUTRAL. Meta reviews
    // marketing templates more strictly and previously rejected busier
    // discount/offer wording (code 100 / subcode 2388024). This default carries
    // NO offer, discount, percentage, urgency, header, footer, buttons or URL —
    // just a warm check-in. NOT enabled by default; requires marketing opt-in.
    name: "win_back_offer_he",
    label: "החזרת לקוחות",
    language: "he",
    category: "MARKETING",
    // Ends with the Allura line so the body does not end on the {{2}} variable.
    body:
      "היי {{1}}, מזמן לא ראינו אותך ב{{2}}. נשמח לקבוע לך תור חדש בזמן שנוח לך 🙂\nנשלח באמצעות Allura",
    example: ["נועה", "הסטודיו של יעל"],
    variables: ["clientName", "businessName"],
    group: "marketing",
    automationType: "win_back",
  },
];

/**
 * Owner notification template — sent to the BUSINESS OWNER (not a customer) when
 * a new booking arrives from the public booking page.
 *
 * This is intentionally kept OUT of {@link DEFAULT_TEMPLATES}: it is not tied to
 * an AutomationType / per-business AutomationSetting and is not part of the
 * per-business operational/marketing readiness. Allura sends it centrally from
 * its own managed WABA, so the template only needs to exist ONCE in Allura's
 * Meta account. The owner-notify flow references it by name.
 *
 * Meta rules respected: BODY-only, UTILITY category, ends on text (not a
 * variable), positional {{1}}..{{5}}.
 */
export const OWNER_NEW_BOOKING_TEMPLATE = {
  name: "business_new_booking_he",
  label: "התראת תור חדש לבעלת העסק",
  language: "he",
  category: "UTILITY" as MetaTemplateCategory,
  body:
    "היי {{1}} ✨\nנכנסה בקשת תור חדשה ב־Allura:\nלקוחה: {{2}}\nשירות: {{3}}\n{{4}} בשעה {{5}}\n\nלאישור התור — היכנסי ל־Allura",
  example: ["בעלת העסק", "נועה כהן", "מניקור ג'ל", "שלישי 18.6", "10:30"],
  variables: ["ownerName", "clientName", "serviceName", "bookingDate", "bookingTime"],
} as const;

/** The Meta template names we expect, for sync matching. */
export const DEFAULT_TEMPLATE_NAMES = DEFAULT_TEMPLATES.map((t) => t.name);

/** Operational (core/transactional) templates — must all be ready for usable setup. */
export const OPERATIONAL_TEMPLATES = DEFAULT_TEMPLATES.filter(
  (t) => t.group === "operational",
);

/** Marketing templates — optional; a failure here never blocks operational setup. */
export const MARKETING_TEMPLATES = DEFAULT_TEMPLATES.filter(
  (t) => t.group === "marketing",
);

/** True when the template name belongs to the operational (core) group. */
export function isOperationalTemplateName(name: string): boolean {
  return OPERATIONAL_TEMPLATES.some((t) => t.name === name);
}

/** True when the template name belongs to the marketing (optional) group. */
export function isMarketingTemplateName(name: string): boolean {
  return MARKETING_TEMPLATES.some((t) => t.name === name);
}

export function getDefaultTemplateForType(
  type: AutomationType,
): DefaultTemplate | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.automationType === type);
}
