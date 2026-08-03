/**
 * לוגר מובנה (structured logging) קליל, ללא תלות חיצונית.
 *
 * בפרודקשן כל רשומה נכתבת כשורת JSON אחת ל-stdout — פורמט שמערכות
 * איסוף לוגים (Vercel Observability, Datadog וכו') יודעות לפרסר ולחפש בו.
 * בפיתוח הפלט קריא לאדם.
 *
 * זהו נקודת הריכוז היחידה לתיעוד שגיאות בייצור. כל השגיאות הקריטיות עוברות
 * דרך captureError(), ומשם — בנוסף ללוג — נשלחת התראה אקטיבית ל-Webhook
 * (ERROR_ALERT_WEBHOOK_URL). לוג לבדו אינו ניטור: הוא דורש שמישהו ייכנס
 * לחפש בו. כדי לחבר Sentry בעתיד, מוסיפים Sentry.captureException באותו מקום.
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

// ---------------------------------------------------------------------------
// התראות אקטיביות על שגיאות
// ---------------------------------------------------------------------------

/**
 * חלון השתקה לכל scope. בלעדיו, תקלה שחוזרת בכל בקשה (מסד נתונים נופל,
 * טוקן Meta שפג) הופכת לאלפי קריאות Webhook בדקה — מה שמציף את ערוץ
 * ההתראות, ובמקרה של Make/Slack גם שורף מכסה. התראה אחת לכל אזור בכל חמש
 * דקות מספיקה כדי לדעת שמשהו שבור.
 */
const ALERT_THROTTLE_MS = 5 * 60 * 1000;

/**
 * זיכרון פר-מופע (in-memory). בסביבת serverless כל מופע מחזיק מפה משלו, ולכן
 * ההשתקה אינה גלובלית — זו פשרה מכוונת: הימנעות מכתיבה למסד הנתונים בנתיב
 * טיפול בשגיאות, שהוא בדיוק הנתיב שבו המסד עלול להיות זה שנפל.
 */
const lastAlertAtByScope = new Map<string, number>();

/** מקצר מחרוזת ארוכה כדי שגוף ה-Webhook יישאר קטן וקריא. */
function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function shouldAlert(scope: string, now: number): boolean {
  const last = lastAlertAtByScope.get(scope);
  if (last !== undefined && now - last < ALERT_THROTTLE_MS) return false;
  lastAlertAtByScope.set(scope, now);
  return true;
}

/**
 * שולח התראה ל-Webhook חיצוני (Make / Slack / כל מקבל JSON).
 *
 * best-effort במלוא מובן המילה: לא ממתינים לתשובה ולא מכשילים את הזרימה
 * הקוראת. אם ההתראה עצמה נכשלת — נרשמת אזהרה בלוג ותו לא, כדי שלא ניצור
 * לולאת שגיאות (שגיאה → התראה → שגיאה).
 */
function sendErrorAlert(scope: string, err: unknown, context?: LogFields): void {
  const url = (process.env.ERROR_ALERT_WEBHOOK_URL ?? "").trim();
  // ערוץ גיבוי: אימייל. חיבור Webhook דורש חשבון Make/Slack וקונפיגורציה
  // חיצונית, ובלעדיו לא נשלחה שום התראה — כלומר שגיאה בייצור נכתבה ללוג ואיש
  // לא ידע עליה. Resend כבר מוגדר בפרודקשן, ולכן די בכתובת אחת כדי שההתראות
  // יעבדו בפועל.
  const alertEmail = (process.env.ERROR_ALERT_EMAIL ?? "").trim();
  if (!url && !alertEmail) return;
  // בפיתוח לא מציפים את ערוץ ההתראות האמיתי בשגיאות של עבודה מקומית.
  // נקרא בזמן אמת (ולא מ-isProd שנקבע בטעינת המודול) כדי שאפשר יהיה לכסות
  // את ההתנהגות בבדיקות בלי לטעון את המודול מחדש.
  if (process.env.NODE_ENV !== "production") return;
  if (!shouldAlert(scope, Date.now())) return;

  const serialized = serializeError(err);
  const payload = {
    source: "allura",
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    scope,
    message: truncate(String(serialized.errMessage ?? "error"), 500),
    stack: truncate(String(serialized.errStack ?? ""), 1500),
    context: context ?? {},
    time: new Date().toISOString(),
    // טקסט מוכן לקריאה — Slack מציג אותו כמו שהוא, ו-Make יכול להעביר אותו כהודעה.
    text: `🔴 Allura — שגיאה ב-${scope}: ${truncate(String(serialized.errMessage ?? "error"), 300)}`,
  };

  const onFailure = (alertErr: unknown) => {
    emit("warn", "[alert] שליחת התראת שגיאה נכשלה", {
      scope,
      ...serializeError(alertErr),
    });
  };

  if (url) {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(onFailure);
  }

  if (alertEmail) {
    const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
    const from = (process.env.EMAIL_FROM ?? "").trim();
    // לא מייבאים את שכבת האימייל: היא מייבאת את הלוגר, וייבוא הדדי היה יוצר
    // מעגל. קריאת fetch אחת שומרת על המודול הזה נטול תלויות (גם ב-Edge).
    if (apiKey && from) {
      void fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: alertEmail,
          subject: `🔴 Allura — שגיאה ב-${scope}`,
          text: [
            payload.text,
            "",
            `סביבה: ${payload.env}`,
            `זמן: ${payload.time}`,
            "",
            payload.stack || "(ללא stack)",
            "",
            `הקשר: ${JSON.stringify(payload.context)}`,
          ].join("\n"),
        }),
      }).catch(onFailure);
    }
  }
}

/**
 * תיעוד שגיאה קריטית בנקודה מרכזית אחת.
 *
 * `scope` מזהה את האזור (למשל "payments.webhook", "cron.morning-reminder")
 * כדי שאפשר יהיה לסנן/להתריע לפי אזור. `context` הוא מטא-דאטה בטוח לתיעוד
 * (אסור להעביר טוקנים/סודות).
 *
 * מלבד הכתיבה ללוג, נשלחת כאן גם התראה אקטיבית (ראו sendErrorAlert).
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

  sendErrorAlert(scope, err, context);

  // לחיבור Sentry בעתיד:
  //   if (sentryEnabled) Sentry.captureException(err, { tags: { scope }, extra: context });
}

/** לשימוש בבדיקות בלבד — מאפס את חלון ההשתקה של ההתראות. */
export function __resetErrorAlertThrottleForTests(): void {
  lastAlertAtByScope.clear();
}
