/**
 * לוגר מובנה (structured logging) קליל, ללא תלות חיצונית.
 *
 * בפרודקשן כל רשומה נכתבת כשורת JSON אחת ל-stdout — פורמט שמערכות
 * איסוף לוגים (Vercel Observability, Datadog וכו') יודעות לפרסר ולחפש בו.
 * בפיתוח הפלט קריא לאדם.
 *
 * זהו נקודת הריכוז היחידה לתיעוד שגיאות בייצור. כדי לחבר Sentry בעתיד,
 * מספיק להוסיף קריאה ל-Sentry.captureException בתוך captureError() — כל
 * השגיאות הקריטיות כבר עוברות דרך שם.
 *
 * המודול טהור (ללא Node APIs) כדי שיעבוד גם ב-Edge וגם ב-Node runtime.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const isProd = process.env.NODE_ENV === "production";

// בפרודקשן מדלגים על debug; בפיתוח מציגים הכל.
const MIN_WEIGHT = isProd ? LEVEL_WEIGHT.info : LEVEL_WEIGHT.debug;

/** הופך ערך שגיאה לאובייקט ניתן-לסריאליזציה (ללא חשיפת סודות). */
function serializeError(err: unknown): LogFields {
  if (err instanceof Error) {
    return {
      errName: err.name,
      errMessage: err.message,
      // ב-stack לא נחשפים סודות; הוא עוזר מאוד לאיתור תקלות בייצור.
      errStack: err.stack,
    };
  }
  return { errMessage: String(err) };
}

function emit(level: LogLevel, message: string, fields?: LogFields): void {
  if (LEVEL_WEIGHT[level] < MIN_WEIGHT) return;

  const time = new Date().toISOString();

  if (isProd) {
    // שורת JSON אחת — נוחה לאיסוף ולחיפוש.
    const line = JSON.stringify({ level, time, msg: message, ...fields });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return;
  }

  // פיתוח: פלט קריא.
  const prefix = `[${level.toUpperCase()}]`;
  const extra = fields && Object.keys(fields).length > 0 ? fields : undefined;
  if (level === "error") console.error(prefix, message, extra ?? "");
  else if (level === "warn") console.warn(prefix, message, extra ?? "");
  else console.log(prefix, message, extra ?? "");
}

export const logger = {
  debug: (message: string, fields?: LogFields) => emit("debug", message, fields),
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};

/**
 * תיעוד שגיאה קריטית בנקודה מרכזית אחת.
 *
 * `scope` מזהה את האזור (למשל "payments.webhook", "cron.morning-reminder")
 * כדי שאפשר יהיה לסנן/להתריע לפי אזור. `context` הוא מטא-דאטה בטוח לתיעוד
 * (אסור להעביר טוקנים/סודות).
 *
 * נקודת חיבור עתידית ל-Sentry: כאן.
 */
export function captureError(
  scope: string,
  err: unknown,
  context?: LogFields,
): void {
  emit("error", `[${scope}] ${err instanceof Error ? err.message : "error"}`, {
    scope,
    ...serializeError(err),
    ...context,
  });

  // לחיבור Sentry בעתיד:
  //   if (sentryEnabled) Sentry.captureException(err, { tags: { scope }, extra: context });
}
