/**
 * The Allura subscription plan (see [[project_subscribe_paywall]]).
 *
 * Allura has exactly ONE plan: one price, every feature. There is no tier to
 * compare, upgrade to, or gate a feature behind — an account either pays and
 * gets the whole product, or has no access at all.
 *
 * This is the single source of truth for the price and the feature list. Kept
 * free of `@prisma/client` imports so it can be used from client components; the
 * server re-validates the plan against the Prisma `AccountPlan` enum.
 */

/** The only plan id — mirrors the `standard` value of the Prisma AccountPlan enum. */
export type PlanId = "standard";

export interface PlanInfo {
  id: PlanId;
  name: string;
  price: number;
  tagline: string;
  features: string[];
}

export const ALLURA_PLAN: PlanInfo = {
  id: "standard",
  name: "מנוי Allura",
  price: 199,
  tagline: "כל הכלים לניהול ולהצמחת העסק — במנוי אחד, בלי מדרגות",
  features: [
    "יומן תורים חכם",
    "ניהול לקוחות (CRM) מלא",
    "שירותים, מחירים וזמינות",
    "דף הזמנות ציבורי",
    "הודעות WhatsApp מוכנות לשליחה",
    "תזכורות אוטומטיות ללקוחות",
    "ניהול ביטולים ואי-הגעה",
    "רשימת המתנה",
    "זיהוי חלונות פנויים ביומן",
    "מרכז החזרת לקוחות",
    "זיהוי לקוחות בסיכון נטישה",
    "קמפיינים אוטומטיים ב-WhatsApp",
    "מועדון נאמנות ללקוחות",
    "מוניטין וביקורות מלקוחות",
    "מעקב הכנסות, הוצאות ורווח",
    "תחזית הכנסות חכמה",
    "תובנות מחירים חכמות",
    "עוזר AI לניהול העסק",
    "תמיכה מלאה בעברית",
  ],
};

/** Authoritative monthly list price in shekels (also enforced server-side). */
export const PLAN_PRICE = ALLURA_PLAN.price;
