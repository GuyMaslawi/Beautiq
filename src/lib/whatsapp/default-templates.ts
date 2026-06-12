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

export type MetaTemplateCategory = "UTILITY" | "MARKETING";

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
    body: "שלום {{1}}, התור שלך ל{{2}} נקבע לתאריך {{3}} בשעה {{4}}. נשמח לראותך! 💛",
    example: ["דנה", "מניקור ג'ל", "12 ביוני", "14:30"],
    variables: ["clientName", "serviceName", "bookingDate", "bookingTime"],
    automationType: "booking_confirmation",
  },
  {
    name: "appointment_reminder_he",
    label: "תזכורת לתור",
    language: "he",
    category: "UTILITY",
    body: "היי {{1}}, תזכורת לתור שלך ל{{2}} מחר בשעה {{3}} ב{{4}}. נתראה!",
    example: ["דנה", "מניקור ג'ל", "14:30", "סטודיו ביוטי"],
    variables: ["clientName", "serviceName", "bookingTime", "businessName"],
    automationType: "morning_reminder",
  },
  {
    name: "review_request_he",
    label: "בקשת ביקורת",
    language: "he",
    category: "UTILITY",
    body: "תודה שבחרת ב{{3}}, {{1}}! נשמח אם תוכלי לדרג את ה{{2}} שקיבלת: {{4}}",
    example: ["דנה", "מניקור ג'ל", "סטודיו ביוטי", "https://allura.co/b/studio#reviews"],
    variables: ["clientName", "serviceName", "businessName", "reviewLink"],
    automationType: "review_request",
  },
  {
    name: "win_back_offer_he",
    label: "החזרת לקוחה",
    language: "he",
    category: "MARKETING",
    body: "שלום {{1}}, מתגעגעים אליך ב{{2}}! נשמח לראותך שוב ל{{3}}. {{4}}",
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
