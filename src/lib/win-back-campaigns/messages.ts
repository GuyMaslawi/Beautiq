import type { CampaignType } from "@/server/win-back-campaigns/queries";

export type MessageTone = "gentle" | "personal" | "sales" | "luxury" | "short";

export type OfferType =
  | "none"
  | "discount_10"
  | "upgrade_gift"
  | "special_slot"
  | "reduced_deposit"
  | "personal";

export const OFFER_TEXT: Record<OfferType, string> = {
  none: "",
  discount_10: "10% הנחה",
  upgrade_gift: "שדרוג טיפול מתנה",
  special_slot: "תור פנוי מיוחד",
  reduced_deposit: "מקדמה מופחתת",
  personal: "הטבה אישית",
};

export const DEFAULT_TEMPLATES: Record<MessageTone, Record<CampaignType, string>> = {
  gentle: {
    "30": "היי {שם}, מה שלומך? ראיתי שלא ביקרת אצלנו כבר תקופה ורציתי להזמין אותך לקבוע תור חדש בזמן שנוח לך 💕",
    "60": "היי {שם}, התגעגענו אלייך ב{שם העסק} ✨ אשמח לפנק אותך בתור חדש ולשמור לך זמן שמתאים לך.",
    "90": "היי {שם}, הרבה זמן לא נפגשנו ורציתי לשמור איתך על קשר 🌸 אשמח לשמוע שלומך ולקבוע לך תור חדש.",
    vip: "היי {שם}, שמתי לב שלא נפגשנו כבר תקופה ורציתי לשמור איתך על קשר. אשמח לקבוע לך תור חדש בזמן שנוח לך 💛",
  },
  personal: {
    "30": "היי {שם}! ממש חסרת לנו 💕 אם תרצי לקבוע תור – שמרי מקום לפני שהיומן מתמלא.",
    "60": "היי {שם}, חשבתי עלייך ✨ אשמח לראות אותך שוב אצלנו ב{שם העסק} — הכי טוב שנעשה לך מקום.",
    "90": "היי {שם}, התגעגעתי 🌸 בואי נקבע תור ונתפוס זמן לפני שהיומן מתמלא.",
    vip: "היי {שם}, את לקוחה מיוחדת לנו ואשמח לפנק אותך בתור הקרוב 💛 מתי נוח לך?",
  },
  sales: {
    "30": "היי {שם}, יש לנו מקומות פנויים השבוע ב{שם העסק}! תרצי לנצל ולקבוע תור? 🙌",
    "60": "היי {שם}, רצינו לעדכן שיש לנו מקומות פנויים עכשיו ב{שם העסק}. תרצי להגיע?",
    "90": "היי {שם}, מזמן לא נפגשנו! יש לנו מקומות מעולים ב{שם העסק} — תרצי לקבוע?",
    vip: "היי {שם}, הכנו הצעה מיוחדת ללקוחות VIP שלנו ב{שם העסק}. תרצי לשמוע?",
  },
  luxury: {
    "30": "שלום {שם}, ב{שם העסק} אנחנו מקפידים לשמור על קשר אישי. אשמח לשמור לך מקום ברשימת העדיפות.",
    "60": "שלום {שם}, ב{שם העסק} תמיד שומרים מקום ללקוחות המיוחדות. אשמח לקבוע לך תור בזמן שנוח לך.",
    "90": "שלום {שם}, ב{שם העסק} חשוב לנו לשמור על קשר אישי עם לקוחותינו. אשמח לשמוע שלומך ולקבוע לך מקום מועדף.",
    vip: "שלום {שם}, ב{שם העסק} לקוחות VIP שלנו תמיד מקבלות יחס מועדף. אשמח לשמור לך מקום בלוח הזמנים.",
  },
  short: {
    "30": "היי {שם} 👋 מתי קובעים תור חדש?",
    "60": "היי {שם}, מזמן לא ראינו אותך 😊 מתי תגיעי?",
    "90": "היי {שם}, חסרת לנו! מתי קובעים?",
    vip: "היי {שם} 💛 מתי נפגשים?",
  },
};

export function renderMessage(
  template: string,
  vars: {
    clientName: string;
    businessName: string;
    lastService?: string;
    offer?: string;
    bookingLink?: string;
  },
): string {
  return template
    .replace(/{שם}/g, vars.clientName)
    .replace(/{שם העסק}/g, vars.businessName)
    .replace(/{שירות אחרון}/g, vars.lastService ?? "")
    .replace(/{הטבה}/g, vars.offer ?? "")
    .replace(/{קישור להזמנה}/g, vars.bookingLink ?? "");
}

const OFFER_MESSAGE_LINES: Record<OfferType, string> = {
  none: "",
  discount_10: "\n\n🎁 ויש עוד בשורה טובה — הכנתי לך 10% הנחה על התור הקרוב!",
  upgrade_gift: "\n\n🎁 ויש עוד — הכנתי לך שדרוג טיפול מתנה לפגישה הבאה!",
  special_slot: "\n\n📅 שמרתי לך תור פנוי מיוחד — רק תגידי מתי את פנויה.",
  reduced_deposit: "\n\n💳 והפעם המקדמה תהיה מופחתת במיוחד בשבילך.",
  personal: "\n\n🎁 הכנתי לך הטבה אישית מיוחדת — ספרי לי מתי את פנויה.",
};

export function getDefaultTemplate(
  type: CampaignType,
  tone: MessageTone,
  offer: OfferType = "none",
): string {
  const base = DEFAULT_TEMPLATES[tone][type];
  if (offer === "none") return base;
  return base + OFFER_MESSAGE_LINES[offer];
}

// Backward compatibility for existing callers
export function generateWinBackMessage(params: {
  campaignType: CampaignType;
  clientName: string;
  businessName: string;
}): string {
  return renderMessage(DEFAULT_TEMPLATES.gentle[params.campaignType], {
    clientName: params.clientName,
    businessName: params.businessName,
  });
}
