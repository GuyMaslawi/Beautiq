/**
 * Next.js instrumentation — רץ פעם אחת בעליית השרת.
 *
 * כאן אנו מאמתים את משתני הסביבה כדי להיכשל מהר וברור:
 *   - בפרודקשן: שגיאות אימות זורקות ומונעות עליית שרת עם תצורה שבורה.
 *   - בפיתוח: רק מזהירים, כדי לא לחסום פיתוח מקומי.
 *
 * רץ רק ב-Node runtime (לא ב-Edge), שם משתני הסביבה זמינים במלואם.
 *
 * בנוסף, onRequestError תופס *כל* שגיאה לא-מטופלת בשרת (רינדור עמוד, Server
 * Action, route handler) ומעביר אותה ל-captureError. עד עכשיו רק שגיאות
 * שנתפסו ידנית ב-try/catch דיווחו על עצמן; קריסה בעמוד שאיש לא עטף פשוט
 * הציגה מסך שגיאה ללקוחה ונעלמה בלוגים.
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

/**
 * Hook של Next.js לכל שגיאת שרת לא-מטופלת.
 *
 * מדווח דרך captureError כדי שגם שגיאות שלא נתפסו ידנית יגיעו לערוץ ההתראות
 * (ERROR_ALERT_WEBHOOK_URL). ה-scope כולל את הנתיב כדי שאפשר יהיה להבחין בין
 * "העמוד /bookings קורס" לבין "ה-webhook נכשל" — וגם כדי שהשתקת ההתראות
 * החוזרות תהיה פר-נתיב ולא אחת לכל האפליקציה.
 */
export async function onRequestError(
  err: unknown,
  request: { path?: string; method?: string },
  context?: { routerKind?: string; routeType?: string },
): Promise<void> {
  const { captureError } = await import("@/lib/logger");
  const path = request?.path ?? "unknown";
  captureError(`request.${path}`, err, {
    path,
    method: request?.method,
    routerKind: context?.routerKind,
    routeType: context?.routeType,
  });
}
