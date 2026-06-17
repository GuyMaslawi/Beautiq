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
    // Minimal BODY-only utility template. No header / footer / buttons. Kept
    // deliberately simple and clearly transactional so Meta accepts it as UTILITY
    // (the previous, busier wording was rejected with code 100 / subcode 2388024).
    body: "היי {{1}}, התור שלך ל{{2}} נקבע ליום {{3}} בשעה {{4}}. נשמח לראותך 🙂",
    example: ["נועה", "לק ג'ל", "שלישי 18.6", "10:30"],
    variables: ["clientName", "serviceName", "bookingDate", "bookingTime"],
    automationType: "booking_confirmation",
  },
  {
    name: "appointment_reminder_he",
    label: "תזכורת לתור",
    language: "he",
    category: "UTILITY",
    // Minimal BODY-only utility template with 3 sequential variables. Dropped the
    // trailing business-name variable (the old {{4}} sat near the end of the body)
    // to keep the reminder short and unambiguous after the 2388024 rejection.
    body: "היי {{1}}, תזכורת לתור שלך ל{{2}} מחר בשעה {{3}}. נתראה בקרוב 🙂",
    example: ["נועה", "לק ג'ל", "10:30"],
    variables: ["clientName", "serviceName", "bookingTime"],
    automationType: "morning_reminder",
  },
  {
    name: "review_request_he",
    label: "בקשת ביקורת",
    language: "he",
    category: "UTILITY",
    // Variables must appear in order {{1}}..{{4}} and the body must not end with a
    // variable — Meta rejects out-of-order or trailing variables as "Invalid parameter".
    body: "שלום {{1}}, תודה שבחרת ל{{2}} ב{{3}}! נשמח אם תדרגי את החוויה כאן: {{4}} 🙏",
    example: ["דנה", "מניקור ג'ל", "סטודיו ביוטי", REVIEW_EXAMPLE_LINK],
    variables: ["clientName", "serviceName", "businessName", "reviewLink"],
    automationType: "review_request",
  },
  {
    name: "win_back_offer_he",
    label: "החזרת לקוחה",
    language: "he",
    category: "MARKETING",
    // Trailing emoji keeps the body from ending with the {{4}} variable.
    body: "שלום {{1}}, מתגעגעים אליך ב{{2}}! נשמח לראותך שוב ל{{3}} — {{4}} 💛",
    example: ["דנה", "סטודיו ביוטי", "מניקור ג'ל", "10% הנחה על התור הבא"],
    variables: ["clientName", "businessName", "serviceName", "offer"],
    automationType: "win_back",
  },
];

/** The Meta template names we expect, for sync matching. */
export const DEFAULT_TEMPLATE_NAMES = DEFAULT_TEMPLATES.map((t) => t.name);

export function getDefaultTemplateForType(
  type: AutomationType,
): DefaultTemplate | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.automationType === type);
}
