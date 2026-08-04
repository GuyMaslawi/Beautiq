/**
 * Daily subscription sweep.
 *
 *   GET /api/cron/subscription-sweep   (protected by CRON_SECRET)
 *
 * Closes the app gate for subscriptions that have lapsed but produce no further
 * Grow notification to trigger it:
 *   - `cancelled` subs once their paid period ends (access ran until period end),
 *   - `past_due` subs whose grace window has fully elapsed (a backstop; the
 *     webhook already lapses most failed renewals).
 *
 * "Closing the gate" = mark the subscription `expired` and clear `User.plan`, so
 * requirePaidUser() sends the owner back to /subscribe.
 */

import { NextResponse } from "next/server";
import { AccountSubscriptionStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { RENEWAL_GRACE_DAYS, findOverdueRenewals } from "@/server/subscription/service";
import { notifyTrialLifecycle } from "@/server/subscription/trial-notifications";
import { withCronHeartbeat } from "@/server/ops/cron-heartbeat";
import { pruneRateLimitCounters } from "@/server/rate-limit/persistent";
import { prunePasswordResetTokens } from "@/server/auth/password-reset";
import { logger, captureError } from "@/lib/logger";
import { bearerEquals } from "@/lib/secret-compare";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!bearerEquals(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronHeartbeat("subscription-sweep", runSubscriptionSweepCron);
}

async function runSubscriptionSweepCron() {
  const now = new Date();
  const graceCutoff = new Date(now.getTime() - RENEWAL_GRACE_DAYS * 86_400_000);

  // Cancelled subs whose paid period has ended, plus past_due subs past grace.
  const due = await prisma.accountSubscription.findMany({
    where: {
      OR: [
        {
          status: AccountSubscriptionStatus.cancelled,
          currentPeriodEnd: { lte: now },
        },
        {
          status: AccountSubscriptionStatus.past_due,
          currentPeriodEnd: { lte: graceCutoff },
        },
      ],
    },
    select: { id: true, userId: true },
    take: 500,
  });

  let expired = 0;
  for (const sub of due) {
    try {
      await prisma.$transaction([
        prisma.accountSubscription.update({
          where: { id: sub.id },
          data: { status: AccountSubscriptionStatus.expired },
        }),
        prisma.user.update({
          where: { id: sub.userId },
          data: { plan: null, planActivatedAt: null },
        }),
      ]);
      expired++;
    } catch (err) {
      captureError("cron.subscription-sweep", err, { subscriptionId: sub.id });
    }
  }

  // חידושים שלא הגיעו. Grow מחייב את הוראת הקבע ושולח חיווי שמאריך את התקופה,
  // ולכן מנוי שנשאר `active` הרבה אחרי סוף התקופה שלו הוא מנוי שלא התקבל עבורו
  // חיוב — והוא היחיד שנופל בין הכיסאות: ה-sweep מטפל רק ב-cancelled וב-past_due,
  // אז הגישה נשארת פתוחה בלי תשלום ובלי שאף אחד ידע. לא סוגרים אותה כאן
  // אוטומטית (ראו findOverdueRenewals) — מתריעים, וההחלטה נשארת אנושית.
  let overdueRenewals = 0;
  try {
    const overdue = await findOverdueRenewals(now);
    overdueRenewals = overdue.length;
    if (overdue.length > 0) {
      captureError(
        "subscription.renewal-missing",
        new Error(
          `${overdue.length} מנויים פעילים עברו את מועד החידוש ולא התקבל עבורם חיוב מ-Grow`,
        ),
        {
          count: overdue.length,
          // רק עשרה — מספיק כדי להתחיל לבדוק, בלי לנפח את גוף ההתראה.
          subscriptions: overdue.slice(0, 10).map((s) => ({
            email: s.user.email,
            periodEnd: s.currentPeriodEnd?.toISOString() ?? null,
            lastChargeAt: s.lastChargeAt?.toISOString() ?? null,
            hasDirectDebit: !!s.directDebitId,
          })),
        },
      );
    }
  } catch (err) {
    captureError("cron.subscription-sweep.overdue", err);
  }

  // התראות על תקופת ניסיון שמתקרבת לסיומה או שהסתיימה אתמול. גישת ניסיון
  // נסגרת מעצמה (getCurrentUser בודק את planExpiresAt בזמן אמת), ולכן אין כאן
  // מה לעדכן במסד — רק להודיע לבעלת העסק לפני שהיא מגלה את זה לבד.
  let trialNotices = { ending: 0, ended: 0 };
  try {
    trialNotices = await notifyTrialLifecycle(now);
  } catch (err) {
    captureError("cron.subscription-sweep.trials", err);
  }

  // ניקיון תחזוקה: מוני הגבלת הקצב שבמסד הם רשומות קצרות-חיים, ובלי מחיקה
  // הטבלה צוברת שורה לכל אימייל/IP/עסק לנצח. נתלה כאן כי זו משימת ה-cron
  // היומית היחידה.
  const prunedCounters = await pruneRateLimitCounters();
  // אותו היגיון עבור טוקני שחזור סיסמה שפג תוקפם.
  const prunedResetTokens = await prunePasswordResetTokens();

  logger.info("[cron.subscription-sweep] done", {
    candidates: due.length,
    expired,
    overdueRenewals,
    trialNotices,
    prunedCounters,
    prunedResetTokens,
  });
  return NextResponse.json({
    candidates: due.length,
    expired,
    overdueRenewals,
    trialNotices,
    prunedCounters,
    prunedResetTokens,
  });
}
