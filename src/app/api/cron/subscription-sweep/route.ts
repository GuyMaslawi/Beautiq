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
import { RENEWAL_GRACE_DAYS } from "@/server/subscription/service";
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

  // ניקיון תחזוקה: מוני הגבלת הקצב שבמסד הם רשומות קצרות-חיים, ובלי מחיקה
  // הטבלה צוברת שורה לכל אימייל/IP/עסק לנצח. נתלה כאן כי זו משימת ה-cron
  // היומית היחידה.
  const prunedCounters = await pruneRateLimitCounters();
  // אותו היגיון עבור טוקני שחזור סיסמה שפג תוקפם.
  const prunedResetTokens = await prunePasswordResetTokens();

  logger.info("[cron.subscription-sweep] done", {
    candidates: due.length,
    expired,
    prunedCounters,
    prunedResetTokens,
  });
  return NextResponse.json({
    candidates: due.length,
    expired,
    prunedCounters,
    prunedResetTokens,
  });
}
