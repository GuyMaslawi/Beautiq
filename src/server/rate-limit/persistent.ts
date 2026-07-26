/**
 * הגבלת קצב משותפת לכל מופעי השרת (cross-instance).
 *
 * למה זה קיים בנוסף ל-src/lib/rate-limit.ts:
 * המגביל שבזיכרון מהיר ומצוין לבלימת פרצים, אבל הוא פר-תהליך. ב-Vercel כל
 * בקשה בו-זמנית עלולה לרוץ במופע serverless אחר עם Map משלו, ולכן המכסה
 * בפועל היא (מגבלה × מספר המופעים). מי שמנחש סיסמאות מספיק במקביל מקבל
 * למעשה הגבלה שמתרחבת ככל שהוא לוחץ חזק יותר.
 *
 * לכן, עבור שתי פעולות שבהן המחיר של כשל הוא אמיתי — השתלטות על חשבון,
 * ועלות כספית של הודעות WhatsApp שאנחנו משלמות עליהן — המונה יושב במסד
 * הנתונים ומשותף לכולם.
 *
 * מדיניות כשל: **פתוח (fail open)**. אם המסד לא זמין, אנחנו לא נועלים
 * בעלות עסק מחוץ למערכת שלהן; המגביל שבזיכרון עדיין פועל כשכבה שנייה.
 * שילוב שתי השכבות נותן גם בלימת פרצים מיידית וגם תקרה גלובלית אמיתית.
 */

import { prisma } from "@/server/db/prisma";
import { logger } from "@/lib/logger";

/**
 * בודק והגדיל את המונה עבור `key`. מחזיר true אם הבקשה מותרת.
 *
 * המימוש אטומי מספיק לשימוש שלנו: איפוס חלון שפג תוקפו נעשה בעדכון מותנה
 * (`resetAt <= now`) ולא בקריאה-ואז-כתיבה, ולכן שתי בקשות מקבילות אינן
 * יכולות שתיהן "לאפס" את החלון ולעקוף את המגבלה.
 */
export async function checkPersistentRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<boolean> {
  const now = new Date();
  const nextReset = new Date(now.getTime() + windowMs);

  try {
    // חלון שפג — מאפסים אותו בעדכון מותנה יחיד.
    await prisma.rateLimitCounter.updateMany({
      where: { key, resetAt: { lte: now } },
      data: { count: 0, resetAt: nextReset },
    });

    const row = await prisma.rateLimitCounter.upsert({
      where: { key },
      create: { key, count: 1, resetAt: nextReset },
      update: { count: { increment: 1 } },
      select: { count: true },
    });

    return row.count <= maxRequests;
  } catch (err) {
    // fail open — ראו הערת המדיניות למעלה.
    logger.warn(
      `[rate-limit] persistent check failed, falling back to in-memory only: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return true;
  }
}

/**
 * מנקה שורות שחלון הזמן שלהן הסתיים מזמן. נקרא ממשימת ה-cron היומית כדי
 * שהטבלה לא תצמח לנצח. מחזיר את מספר השורות שנמחקו.
 */
export async function pruneRateLimitCounters(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const { count } = await prisma.rateLimitCounter.deleteMany({
      where: { resetAt: { lt: cutoff } },
    });
    return count;
  } catch {
    return 0;
  }
}
