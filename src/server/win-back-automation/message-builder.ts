/**
 * Builds the WhatsApp win-back message text from the automation template.
 *
 * Supported variables: {שם}, {שם_העסק}, {שירות_אחרון}, {הטבה}, {קישור_להזמנה}
 */

import type { AutomationOfferType } from "@prisma/client";

const OFFER_TEXTS: Record<AutomationOfferType, string> = {
  none: "",
  discount_10: "מגיעה לך הנחה של 10% בתור הבא 🎁",
  upgrade: "שדרוג טיפול מתנה בתור הקרוב 🌟",
  special_slot: "יש לנו תור פנוי מיוחד בשבוע הקרוב — רק בשבילך 🗓️",
  custom: "",
};

const DEFAULT_TEMPLATE =
  "היי {שם}, עבר זמן מה מאז הביקור האחרון שלך ב{שירות_אחרון} אצל {שם_העסק}.\n{הטבה}\nנשמח לראות אותך שוב — ניתן לקבוע תור בכל זמן שנוח לך ❤️";

export interface MessageBuildParams {
  clientName: string;
  businessName: string;
  lastServiceName: string;
  offerType: AutomationOfferType;
  offerValue?: string | null;
  bookingUrl?: string;
  template?: string | null;
}

/** Returns the resolved offer text string for the given offer type/value. */
export function buildOfferText(
  offerType: AutomationOfferType,
  offerValue?: string | null,
): string {
  return offerType === "custom" ? (offerValue ?? "") : (OFFER_TEXTS[offerType] ?? "");
}

export function buildWinBackMessage(params: MessageBuildParams): string {
  const {
    clientName,
    businessName,
    lastServiceName,
    offerType,
    offerValue,
    bookingUrl,
    template,
  } = params;

  const offerText =
    offerType === "custom"
      ? (offerValue ?? "")
      : OFFER_TEXTS[offerType] ?? "";

  const body = template ?? DEFAULT_TEMPLATE;

  return body
    .replace(/\{שם\}/g, clientName)
    .replace(/\{שם_העסק\}/g, businessName)
    .replace(/\{שירות_אחרון\}/g, lastServiceName)
    .replace(/\{הטבה\}/g, offerText)
    .replace(/\{קישור_להזמנה\}/g, bookingUrl ?? "")
    .replace(/\n{2,}/g, "\n") // collapse double blank lines from empty offer
    .trim();
}

export const DEFAULT_WIN_BACK_TEMPLATE = DEFAULT_TEMPLATE;
