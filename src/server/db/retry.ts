import { logger } from "@/lib/logger";

/**
 * Retry ממוקד לשגיאות חיבור חולפות (transient) מול מסד הנתונים.
 *
 * בפרודקשן (Neon pooled + Vercel) הקריאה הראשונה למסד אחרי cold start
 * עלולה להיכשל עם P1001 ("Can't reach database server") למרות שהמסד תקין.
 * במקרים כאלה ניסיון חוזר קצר פותר את הבעיה.
 *
 * חשוב: מנסים שוב אך ורק על קודי שגיאת חיבור מוכרים של Prisma —
 * לא על שגיאות ולידציה, שגיאות עסקיות או חריגות כלליות.
 */

// P1001 — Can't reach database server
// P1002 — Database server reached but timed out
// P1017 — Server has closed the connection
const TRANSIENT_ERROR_CODES = new Set(["P1001", "P1002", "P1017"]);

// עד 3 ניסיונות בסך הכל: מקורי + שני ניסיונות חוזרים עם השהיה עולה.
const RETRY_DELAYS_MS = [500, 1500];

/**
 * מחלץ קוד שגיאה של Prisma אם קיים.
 * PrismaClientKnownRequestError חושף `code`;
 * PrismaClientInitializationError (המקרה של P1001) חושף `errorCode`.
 */
export function getPrismaErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const candidate = err as { code?: unknown; errorCode?: unknown };
  if (typeof candidate.code === "string") return candidate.code;
  if (typeof candidate.errorCode === "string") return candidate.errorCode;
  return undefined;
}

/** האם זו שגיאת חיבור חולפת שבטוח לנסות שוב? */
export function isTransientDbError(err: unknown): boolean {
  const code = getPrismaErrorCode(err);
  return code !== undefined && TRANSIENT_ERROR_CODES.has(code);
}

/**
 * מריץ פעולת מסד נתונים עם עד 3 ניסיונות על שגיאות חיבור חולפות בלבד.
 *
 * `scope` מזהה את הקורא בלוגים (למשל "cron.morning-reminder").
 * כל שגיאה שאינה חולפת נזרקת מיד ללא ניסיון חוזר.
 */
export async function withTransientDbRetry<T>(
  scope: string,
  operation: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (err) {
      const isLastAttempt = attempt > RETRY_DELAYS_MS.length;
      if (!isTransientDbError(err) || isLastAttempt) throw err;

      const delayMs = RETRY_DELAYS_MS[attempt - 1];
      logger.warn(`[${scope}] transient db error — retrying`, {
        cron: scope,
        attempt,
        prismaCode: getPrismaErrorCode(err),
        delayMs,
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
