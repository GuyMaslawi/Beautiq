/**
 * בדיקת same-origin עבור route handlers מותאמים (POST).
 *
 * Server Actions ב-Next.js מוגנות מ-CSRF בברירת מחדל, וכך גם מסלולי NextAuth.
 * route handlers שנכתבו ידנית אינם מקבלים שום הגנה כזו: דף זר יכול לשלוח
 * טופס POST פשוט (ללא preflight) לכתובת שלנו, והדפדפן יצרף את ה-cookie
 * בהתאם למדיניות SameSite בלבד.
 *
 * SameSite=Lax אכן חוסם את המקרה הבסיסי, אבל הוא same-SITE ולא same-ORIGIN —
 * תת-דומיין שנפרץ עוקף אותו. במסלולים שמפעילים שליחה המונית של הודעות זו
 * הגנה יחידה ומרומזת מדי, ולכן אנו בודקים במפורש.
 *
 * נכשל סגור: בקשה בלי Sec-Fetch-Site ובלי Origin נדחית.
 */

import { APP_URL } from "@/lib/config";

export function isSameOrigin(request: Request): boolean {
  // דפדפנים מודרניים — הכותרת נקבעת על ידי הדפדפן ואינה ניתנת לזיוף מ-JS.
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";

  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(APP_URL).origin;
  } catch {
    return false;
  }
}
