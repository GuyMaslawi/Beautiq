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
import { logger, captureError } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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

  logger.info("[cron.subscription-sweep] done", { candidates: due.length, expired });
  return NextResponse.json({ candidates: due.length, expired });
}
