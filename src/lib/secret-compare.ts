/**
 * השוואת סודות בזמן קבוע (timing-safe).
 *
 * השוואה רגילה עם `===` יוצאת ברגע שנמצא הבדל בבית הראשון, ולכן זמן התגובה
 * מדליף כמה תווים מתחילת הסוד נוחשו נכון. תוקף שמודד זמנים יכול לשחזר את
 * הסוד בית אחר בית. הפונקציה כאן מגשרת (hash) את שני הצדדים ל-SHA-256 —
 * כך האורך תמיד זהה (32 בתים) ואינו מדליף מידע בעצמו — ומשווה עם
 * timingSafeEqual.
 *
 * נכשלת סגור (fail closed): אם אחד הצדדים חסר או ריק — התוצאה false.
 * כך סוד שלא הוגדר בסביבה לעולם לא "מאשר" בקשה במקום לחסום אותה.
 *
 * Server-only.
 */

import { createHash, timingSafeEqual } from "crypto";

export function secretEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length === 0 || b.length === 0) return false;

  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

/**
 * גרסה נוחה לכותרת `Authorization: Bearer <secret>`: מחזירה true רק כאשר
 * הסוד מוגדר והכותרת תואמת לו בדיוק.
 */
export function bearerEquals(
  authorizationHeader: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  if (!secret) return false;
  return secretEquals(authorizationHeader, `Bearer ${secret}`);
}
