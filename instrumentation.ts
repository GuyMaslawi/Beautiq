/**
 * Next.js instrumentation — רץ פעם אחת בעליית השרת.
 *
 * כאן אנו מאמתים את משתני הסביבה כדי להיכשל מהר וברור:
 *   - בפרודקשן: שגיאות אימות זורקות ומונעות עליית שרת עם תצורה שבורה.
 *   - בפיתוח: רק מזהירים, כדי לא לחסום פיתוח מקומי.
 *
 * רץ רק ב-Node runtime (לא ב-Edge), שם משתני הסביבה זמינים במלואם.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // מאפשר לדלג על האימות בסביבות בנייה/CI שאין בהן את כל הסודות.
  if ((process.env.SKIP_ENV_VALIDATION ?? "").trim().toLowerCase() === "true") return;

  const { checkEnv } = await import("@/lib/env");
  const { logger } = await import("@/lib/logger");

  const { errors, warnings } = checkEnv();

  for (const w of warnings) {
    logger.warn(`[env] ${w}`);
  }

  if (errors.length > 0) {
    for (const e of errors) {
      logger.error(`[env] ${e}`);
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `אימות משתני הסביבה נכשל (${errors.length} שגיאות) — ראו לוג למעלה. השרת לא יעלה עם תצורה שבורה.`,
      );
    }
  } else {
    logger.info("[env] אימות משתני הסביבה עבר בהצלחה.");
  }
}
