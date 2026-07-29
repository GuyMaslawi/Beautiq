/**
 * שחזור סיסמה עצמאי ("שכחתי סיסמה") — לוגיקת הליבה.
 *
 * למה זה קיים: עד עכשיו רק מנהל פלטפורמה יכול היה לאפס סיסמה. כלומר סיסמה
 * שדלפה — או שפשוט נשכחה — השביתה בעלת עסק עד להתערבות אנושית. זה גם פער
 * אבטחתי (אין דרך מהירה לסובב אישור שנחשף) וגם פער תפעולי.
 *
 * החלטות אבטחה, ולמה:
 *
 * 1. **נשמר רק hash של הטוקן.** הטוקן הגולמי נשלח לאימייל ומיד נשכח. מי
 *    שמשיג גישת קריאה למסד (גיבוי שדלף, SQL injection עתידי, עובד) לא יכול
 *    להפוך את הטבלה לקישורי שחזור עובדים.
 *
 * 2. **אין הדלפת קיום חשבון (user enumeration).** הבקשה מחזירה בדיוק אותה
 *    תשובה בין אם המייל רשום ובין אם לא. אחרת הטופס הזה הופך למנוע לגילוי
 *    אילו כתובות רשומות במערכת.
 *
 * 3. **הטוקן חד-פעמי וקצר-מועד**, ובקשה חדשה מבטלת את הקודמות — כך שקישור
 *    ישן שנשאר בתיבת המייל אינו נשק.
 *
 * 4. **מימוש מוצלח חותם sessionsValidFrom.** זה החיבור הקריטי: אם התוקף כבר
 *    מחזיק סשן פעיל, החלפת הסיסמה לבדה לא הייתה מוציאה אותו (סשנים הם JWT
 *    ללא מצב בשרת). החותם פוסל כל סשן שהונפק לפני הרגע הזה.
 *
 * Server-only.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/server/db/prisma";
import { hashPassword } from "@/server/auth/password";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { escapeHtml } from "@/lib/email/html";
import { APP_URL, SUPPORT_EMAIL } from "@/lib/config";
import { logger } from "@/lib/logger";

/** תוקף הקישור. קצר מספיק כדי לצמצם חלון ניצול, ארוך מספיק לשימוש אמיתי. */
const TOKEN_TTL_MS = 60 * 60_000; // שעה

/** אורך הטוקן בבתים לפני קידוד. 32 בתים = 256 ביט אנטרופיה. */
const TOKEN_BYTES = 32;

/** גיבוב הטוקן לשמירה. SHA-256 מספיק: הקלט הוא אקראי ברמה קריפטוגרפית. */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/** יוצר טוקן גולמי חדש ואת הגיבוב שלו. */
function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(TOKEN_BYTES).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

/** בונה את קישור השחזור המלא. */
export function buildResetUrl(rawToken: string): string {
  return `${APP_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

// ---------------------------------------------------------------------------
// שלב 1 — בקשת שחזור
// ---------------------------------------------------------------------------

/**
 * יוצר טוקן שחזור ושולח אותו במייל.
 *
 * לעולם אינו מגלה אם המייל קיים: הקורא מחזיר תמיד את אותה הודעה. הפונקציה
 * מחזירה מידע פנימי (`delivered`) לצורכי לוג בלבד — אסור להחזיר אותו ללקוח.
 */
export async function issuePasswordReset(
  email: string,
): Promise<{ delivered: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  // אין חשבון — יוצאים בשקט. הקורא יציג את אותה הודעת הצלחה בדיוק.
  if (!user) {
    logger.info("[password-reset] requested for unknown email (no-op)");
    return { delivered: false, reason: "unknown_email" };
  }

  const { raw, hash } = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  // בקשה חדשה מבטלת כל טוקן קודם שטרם מומש: רק הקישור האחרון עובד, כך
  // שקישורים ישנים שנותרו בתיבת המייל אינם ניתנים לניצול.
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt },
    }),
  ]);

  const url = buildResetUrl(raw);

  // בפיתוח, כשאין ספק אימייל מוגדר, הקישור נרשם ללוג כדי שאפשר יהיה לבדוק
  // את הזרימה. לעולם לא בפרודקשן — לוגים נשמרים ומועברים, וקישור שחזור
  // בלוג הוא סיסמה בלוג לכל דבר.
  if (!isEmailConfigured() && process.env.NODE_ENV !== "production") {
    logger.info(`[password-reset] DEV — email not configured, link: ${url}`);
    return { delivered: false, reason: "email_not_configured" };
  }

  const greeting = user.name ? `היי ${user.name},` : "היי,";
  const text = [
    greeting,
    "",
    "קיבלנו בקשה לאיפוס הסיסמה שלך ב-Allura.",
    "לבחירת סיסמה חדשה יש להיכנס לקישור הבא:",
    url,
    "",
    "הקישור תקף לשעה אחת וניתן לשימוש פעם אחת בלבד.",
    "אם לא ביקשת לאפס סיסמה, אפשר פשוט להתעלם מההודעה — הסיסמה הנוכחית נשארת בתוקף.",
    "",
    `לכל שאלה אנחנו כאן: ${SUPPORT_EMAIL}`,
  ].join("\n");

  const html = buildResetEmailHtml({ greeting, url });

  const result = await sendEmail({
    to: user.email,
    subject: "איפוס הסיסמה שלך ב-Allura",
    text,
    html,
  });

  if (!result.ok) {
    logger.warn("[password-reset] email dispatch failed", {
      reason: "reason" in result ? result.reason : "unknown",
    });
    return { delivered: false, reason: "send_failed" };
  }

  logger.info("[password-reset] reset link sent", { userId: user.id });
  return { delivered: true };
}

/** תבנית האימייל. כל ערך דינמי עובר escapeHtml (ראו lib/email/html.ts). */
function buildResetEmailHtml({
  greeting,
  url,
}: {
  greeting: string;
  url: string;
}): string {
  const safeUrl = escapeHtml(url);
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#faf7f8;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:24px">
    <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #efe6ec">
      <p style="margin:0 0 8px;color:#2b2229;font-size:16px;font-weight:600">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 16px;color:#8a7f86;font-size:14px;line-height:22px">
        קיבלנו בקשה לאיפוס הסיסמה שלך ב־Allura. לבחירת סיסמה חדשה יש ללחוץ על הכפתור:
      </p>
      <p style="margin:0 0 20px">
        <a href="${safeUrl}" style="display:inline-block;background:#ac5c7f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;font-size:15px">בחירת סיסמה חדשה</a>
      </p>
      <p style="margin:0 0 16px;color:#8a7f86;font-size:12px;line-height:20px">
        הקישור תקף לשעה אחת וניתן לשימוש פעם אחת בלבד.<br/>
        אם לא ביקשת לאפס סיסמה — אפשר להתעלם מההודעה, והסיסמה הנוכחית נשארת בתוקף.
      </p>
      <p style="margin:0;color:#b3a8b0;font-size:11px;word-break:break-all">
        אם הכפתור לא עובד: ${safeUrl}
      </p>
    </div>
    <p style="margin:16px 0 0;text-align:center;color:#b3a8b0;font-size:11px">Allura · ניהול תורים ולקוחות</p>
  </div>
</body></html>`;
}

// ---------------------------------------------------------------------------
// שלב 2 — אימות ומימוש
// ---------------------------------------------------------------------------

export type ResetTokenState =
  | { valid: true; userId: string; tokenId: string }
  | { valid: false; reason: "invalid" | "expired" | "used" };

/**
 * בודק טוקן גולמי מול המסד. מחזיר את מצבו מבלי לשנות דבר — כדי שעמוד
 * השחזור יוכל להציג שגיאה ברורה עוד לפני שהמשתמשת מקלידה סיסמה.
 */
export async function checkResetToken(raw: string): Promise<ResetTokenState> {
  if (!raw || raw.length > 512) return { valid: false, reason: "invalid" };

  const hash = hashToken(raw);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true, tokenHash: true },
  });
  if (!row) return { valid: false, reason: "invalid" };

  // השוואה בזמן קבוע. החיפוש עצמו כבר נעשה לפי גיבוב (ולכן אינו מדליף זמן),
  // אבל ההשוואה המפורשת שומרת על הכלל האחיד בקוד הזה: סודות לא מושווים ב-===.
  const a = Buffer.from(row.tokenHash);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "invalid" };
  }

  if (row.usedAt) return { valid: false, reason: "used" };
  if (row.expiresAt.getTime() <= Date.now()) return { valid: false, reason: "expired" };

  return { valid: true, userId: row.userId, tokenId: row.id };
}

/**
 * מממש טוקן: קובע סיסמה חדשה, מסמן את הטוקן כמנוצל, ומבטל כל סשן קיים.
 *
 * הכל בטרנזקציה אחת — אחרת יכול היה להיווצר מצב שבו הסיסמה הוחלפה אך הטוקן
 * נשאר תקף, או שהסיסמה הוחלפה בלי שהסשנים הישנים נפסלו.
 */
export async function consumeResetToken(
  raw: string,
  newPassword: string,
): Promise<ResetTokenState> {
  const state = await checkResetToken(raw);
  if (!state.valid) return state;

  const passwordHash = await hashPassword(newPassword);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: state.userId },
      data: {
        passwordHash,
        // הליבה: פוסל כל סשן שהונפק לפני הרגע הזה. בלי זה, שחזור סיסמה
        // בעקבות פריצה היה משאיר את התוקף מחובר — סשנים הם JWT ואינם
        // נשמרים בשרת. ראו server/auth/session.ts.
        sessionsValidFrom: now,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: state.tokenId },
      data: { usedAt: now },
    }),
    // כל טוקן אחר שטרם מומש לאותה משתמשת מתבטל יחד איתו.
    prisma.passwordResetToken.deleteMany({
      where: { userId: state.userId, usedAt: null },
    }),
  ]);

  logger.info("[password-reset] password changed via reset token", {
    userId: state.userId,
  });
  return state;
}

/**
 * ניקוי טוקנים שפג תוקפם. נקרא ממשימת ה-cron היומית כדי שהטבלה לא תצמח
 * לנצח. מחזיר את מספר השורות שנמחקו.
 */
export async function prunePasswordResetTokens(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const { count } = await prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
    return count;
  } catch {
    return 0;
  }
}
