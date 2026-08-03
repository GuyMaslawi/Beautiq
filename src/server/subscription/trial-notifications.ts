/**
 * התראות על תקופת ניסיון חינם — נשלחות מה-cron היומי (subscription-sweep).
 *
 * גישת ניסיון נסגרת מעצמה ברגע ש-`planExpiresAt` עובר. בלי ההתראות האלה
 * בעלת העסק לא מקבלת שום סימן מוקדם: היא נכנסת בבוקר לנהל את היום, ומוצאת
 * מסך תשלום. שתי הודעות — אחת מבעוד מועד ואחת ביום שאחרי — הופכות את סוף
 * הניסיון להחלטה שלה במקום להפתעה.
 *
 * אין שדה "נשלח" במסד, ולכן החלונות נשענים על כך שה-cron רץ פעם ביום: כל
 * חשבון נופל בדיוק בהרצה אחת. ריצה כפולה חריגה עלולה לשלוח הודעה כפולה —
 * מחיר סביר לעומת מיגרציה נוספת רק בשביל דגל שליחה.
 *
 * Server-only. לעולם אינו זורק — כשל בשליחת מייל לא יפיל את ה-cron.
 */

import { prisma } from "@/server/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { SUPPORT_EMAIL } from "@/lib/config";
import { logger } from "@/lib/logger";

/** כמה ימים מראש נשלחת ההתראה "הניסיון עומד להסתיים". */
export const TRIAL_ENDING_LEAD_DAYS = 3;

const DAY_MS = 86_400_000;

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "https://app.allura.info"
  ).replace(/\/$/, "");
}

function dateHe(d: Date): string {
  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function greeting(name: string | null): string {
  return name ? `היי ${name},` : "היי,";
}

/**
 * שולח את שתי ההתראות הרלוונטיות להרצה הנוכחית ומחזיר כמה נשלחו.
 * `now` נשלח מבחוץ כדי שאפשר יהיה לבדוק את החלונות.
 */
export async function notifyTrialLifecycle(
  now: Date = new Date(),
): Promise<{ ending: number; ended: number }> {
  const endingFrom = new Date(now.getTime() + (TRIAL_ENDING_LEAD_DAYS - 1) * DAY_MS);
  const endingTo = new Date(now.getTime() + TRIAL_ENDING_LEAD_DAYS * DAY_MS);

  // עוד בתוקף — התראה מקדימה.
  const ending = await prisma.user.findMany({
    where: {
      plan: { not: null },
      planExpiresAt: { gte: endingFrom, lt: endingTo },
    },
    select: { id: true, email: true, name: true, planExpiresAt: true },
    take: 200,
  });

  // פג בפרק הזמן שמאז ההרצה הקודמת. חשבון ששילמה בינתיים כבר לא כאן:
  // אישור תשלום מנקה את planExpiresAt.
  const ended = await prisma.user.findMany({
    where: {
      plan: { not: null },
      planExpiresAt: { gte: new Date(now.getTime() - DAY_MS), lt: now },
    },
    select: { id: true, email: true, name: true, planExpiresAt: true },
    take: 200,
  });

  const settingsUrl = `${appUrl()}/settings`;

  for (const user of ending) {
    const endsAt = user.planExpiresAt ? dateHe(user.planExpiresAt) : "";
    await sendEmail({
      to: user.email,
      subject: "תקופת הניסיון שלך ב-Allura מסתיימת בקרוב",
      text:
        `${greeting(user.name)}\n\n` +
        `תקופת הניסיון החינמית שלך ב-Allura מסתיימת ב־${endsAt}.\n` +
        `כדי להמשיך לנהל את העסק בלי הפסקה אפשר להפעיל את המנוי כאן:\n${settingsUrl}\n\n` +
        `הנתונים שלך — לקוחות, תורים והגדרות — נשמרים בכל מקרה.\n` +
        `כל שאלה? אפשר להשיב למייל הזה או לכתוב לנו ל-${SUPPORT_EMAIL}.\n\n` +
        `צוות Allura`,
      replyTo: SUPPORT_EMAIL,
    });
  }

  for (const user of ended) {
    await sendEmail({
      to: user.email,
      subject: "תקופת הניסיון שלך ב-Allura הסתיימה",
      text:
        `${greeting(user.name)}\n\n` +
        `תקופת הניסיון החינמית שלך ב-Allura הסתיימה.\n` +
        `כל הנתונים שלך שמורים וממתינים לך — הם יחזרו במלואם ברגע שהמנוי יופעל:\n${settingsUrl}\n\n` +
        `אם משהו לא עבד כמו שציפית, נשמח לשמוע — אפשר להשיב למייל הזה או לכתוב ל-${SUPPORT_EMAIL}.\n\n` +
        `צוות Allura`,
      replyTo: SUPPORT_EMAIL,
    });
  }

  if (ending.length || ended.length) {
    logger.info("[trial-notifications] sent", {
      ending: ending.length,
      ended: ended.length,
    });
  }

  return { ending: ending.length, ended: ended.length };
}
