/**
 * Self-serve account plans (see [[project_subscribe_paywall]]).
 *
 * A single source of truth for plan pricing, feature lists, and which product
 * features require Platinum. Kept free of `@prisma/client` imports so it can be
 * used from client components; the server action re-validates the plan id
 * against the Prisma `AccountPlan` enum.
 */

export type PlanId = "premium" | "platinum";

export interface PlanInfo {
  id: PlanId;
  name: string;
  price: number;
  tagline: string;
  /** Optional note shown above the feature list (Platinum builds on Premium). */
  featuresIntro?: string;
  features: string[];
}

export const PREMIUM_PLAN: PlanInfo = {
  id: "premium",
  name: "פרימיום",
  price: 149,
  tagline: "כל מה שצריך כדי לנהל את העסק במקום אחד",
  features: [
    "יומן תורים חכם",
    "ניהול לקוחות (CRM) מלא",
    "שירותים, מחירים וזמינות",
    "דף הזמנות ציבורי",
    "הודעות WhatsApp מוכנות לשליחה",
    "ניהול ביטולים ואי-הגעה",
    "רשימת המתנה",
    "זיהוי חלונות פנויים ביומן",
    "תזכורות אוטומטיות ללקוחות",
    "מוניטין וביקורות מלקוחות",
    "מעקב הכנסות, הוצאות ורווח",
    "תובנות מחירים חכמות",
    "תמיכה מלאה בעברית",
  ],
};

export const PLATINUM_PLAN: PlanInfo = {
  id: "platinum",
  name: "פלטינום",
  price: 249,
  tagline: "העסק שלך על אוטומט — עם כלי צמיחה חכמים",
  featuresIntro: "כל הכלים של פרימיום, ובנוסף:",
  features: [
    "עוזר AI לניהול העסק",
    "תחזית הכנסות חכמה",
    "זיהוי לקוחות בסיכון נטישה",
    "מרכז החזרת לקוחות אוטומטי",
    "קמפיינים אוטומטיים ב-WhatsApp",
    "מועדון נאמנות ללקוחות",
    "תמיכת VIP מועדפת",
  ],
};

export const PLANS: Record<PlanId, PlanInfo> = {
  premium: PREMIUM_PLAN,
  platinum: PLATINUM_PLAN,
};

/** Authoritative monthly price per plan (also enforced server-side). */
export const PLAN_PRICES: Record<PlanId, number> = {
  premium: 149,
  platinum: 249,
};

/** True when the given plan value grants Platinum-tier access. */
export function isPlatinumPlan(plan: string | null | undefined): boolean {
  return plan === "platinum";
}
