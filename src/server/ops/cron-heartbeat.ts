/**
 * דופק ה-cron — "האם המשימות המתוזמנות באמת רצות?"
 *
 * זו התקלה השקטה הגרועה ביותר במערכת: אם ה-crons לא רצים, התזכורות לא נשלחות,
 * הקמפיינים תקועים, מועדון הנאמנות מת והמנויים שפגו לא נסגרים — והאפליקציה
 * נראית תקינה לחלוטין. אין שום מסך שבו זה מתגלה, ואף אחד לא מקבל הודעה.
 *
 * כל cron רושם כאן שורת ActivityLog אחת בסיום. המסך `/admin` מציג מתי כל
 * משימה רצה לאחרונה ומסמן באדום משימה ששתקה יותר מדי זמן. אין טבלה חדשה
 * ואין מיגרציה — ActivityLog כבר תומך בשורות ברמת פלטפורמה (businessId null).
 *
 * Server-only. best-effort: כישלון ברישום לעולם לא יפיל משימה אמיתית.
 */

import { prisma } from "@/server/db/prisma";

/** המשימות המתוזמנות, כפי שהן מוגדרות ב-vercel.json. */
export const CRON_JOBS = [
  {
    key: "morning-reminder",
    label: "תזכורות בוקר ללקוחות",
    path: "/api/cron/morning-reminder",
    /** כל כמה דקות המשימה אמורה לרוץ. */
    everyMinutes: 60,
  },
  { key: "win-back", label: "החזרת לקוחות", path: "/api/cron/win-back", everyMinutes: 60 },
  { key: "review-request", label: "בקשות לביקורת", path: "/api/cron/review-request", everyMinutes: 60 },
  { key: "loyalty", label: "מועדון נאמנות", path: "/api/cron/loyalty", everyMinutes: 60 },
  {
    key: "whatsapp-campaigns",
    label: "קמפיינים ב-WhatsApp",
    path: "/api/cron/whatsapp-campaigns",
    everyMinutes: 10,
  },
  {
    key: "subscription-sweep",
    label: "מנויים והתראות ניסיון",
    path: "/api/cron/subscription-sweep",
    everyMinutes: 60 * 24,
  },
] as const;

export type CronKey = (typeof CRON_JOBS)[number]["key"];

/**
 * רושם שהמשימה רצה. נקרא בסוף כל cron, גם כשהיא לא עשתה כלום.
 *
 * כותב ישירות ל-ActivityLog ולא דרך `logActivity`: זו פונקציה שמנסה לזהות את
 * המשתמשת מהסשן, וגוררת איתה את כל NextAuth לתוך ה-cron — שאין לו סשן בכלל.
 * best-effort: כישלון ברישום לעולם לא יפיל משימה אמיתית.
 */
export async function recordCronRun(
  key: CronKey,
  outcome: "ok" | "error",
  metadata?: Record<string, unknown>,
): Promise<void> {
  const job = CRON_JOBS.find((j) => j.key === key);
  try {
    await prisma.activityLog.create({
      data: {
        businessId: null,
        userId: null,
        actorType: "system",
        category: "other",
        action: `cron.${key}`,
        summary:
          outcome === "ok"
            ? `משימה מתוזמנת רצה: ${job?.label ?? key}`
            : `משימה מתוזמנת נכשלה: ${job?.label ?? key}`,
        metadata: { outcome, ...metadata },
      },
    });
  } catch {
    // טלמטריה לעולם לא שוברת את המשימה עצמה.
  }
}

export interface CronHealthRow {
  key: CronKey;
  label: string;
  path: string;
  everyMinutes: number;
  lastRunAt: Date | null;
  lastOutcome: "ok" | "error" | null;
  /** שקטה יותר מדי זמן — או שמעולם לא רצה. */
  stale: boolean;
}

/**
 * מצב כל המשימות. משימה נחשבת "שקטה" אחרי פי 2.5 מהמרווח הצפוי — מספיק סובלני
 * כדי לא להתריע על ריצה שאיחרה, ומספיק הדוק כדי לתפוס משימה שהפסיקה לרוץ.
 */
export async function getCronHealth(now: Date = new Date()): Promise<CronHealthRow[]> {
  const rows = await prisma.activityLog.findMany({
    where: { action: { in: CRON_JOBS.map((j) => `cron.${j.key}`) } },
    select: { action: true, createdAt: true, metadata: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return CRON_JOBS.map((job) => {
    const last = rows.find((r) => r.action === `cron.${job.key}`);
    const outcome =
      last && typeof last.metadata === "object" && last.metadata !== null
        ? ((last.metadata as Record<string, unknown>).outcome as "ok" | "error" | undefined)
        : undefined;
    const staleAfterMs = job.everyMinutes * 60_000 * 2.5;
    return {
      key: job.key,
      label: job.label,
      path: job.path,
      everyMinutes: job.everyMinutes,
      lastRunAt: last?.createdAt ?? null,
      lastOutcome: outcome ?? null,
      stale: !last || now.getTime() - last.createdAt.getTime() > staleAfterMs,
    };
  });
}
