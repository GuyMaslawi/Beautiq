/**
 * Monthly subscription renewal cron.
 *
 *   GET /api/cron/subscription-renewals   (protected by CRON_SECRET)
 *
 * Charges the saved Grow card token for every subscription whose billing period
 * has ended, extending it by another month on success. A failed charge moves
 * the subscription to `past_due` (access continues through a short grace window)
 * and, once the grace window is exhausted, lapses it — clearing the user's plan
 * so the app gate closes.
 *
 * Runs no-op when Grow is not configured, so dev/test never hit the network.
 */

import { NextResponse } from "next/server";
import { AccountSubscriptionStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { tryDecryptSecret } from "@/lib/payments/crypto";
import { isGrowConfigured, chargeToken } from "@/lib/subscription/grow";
import {
  confirmSubscriptionPayment,
  markRenewalFailed,
  RENEWAL_GRACE_DAYS,
} from "@/server/subscription/service";
import { PLANS } from "@/lib/plans";
import { logger, captureError } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGrowConfigured()) {
    logger.info("[cron.subscription-renewals] Grow not configured — skipping");
    return NextResponse.json({ processed: 0, skipped: "grow_not_configured" });
  }

  const now = new Date();
  // Due = active or past_due, period ended. Include a small tail so a repeated
  // grace period gets one attempt per run.
  const due = await prisma.accountSubscription.findMany({
    where: {
      status: { in: [AccountSubscriptionStatus.active, AccountSubscriptionStatus.past_due] },
      currentPeriodEnd: { lte: now },
    },
    take: 500,
  });

  logger.info("[cron.subscription-renewals] starting", { due: due.length });

  let renewed = 0;
  let pastDue = 0;
  let lapsed = 0;

  for (const sub of due) {
    try {
      const cardToken = tryDecryptSecret(sub.cardTokenEncrypted);
      if (!cardToken) {
        // No token to charge with — cannot auto-renew; treat as a failed charge.
        const { lapsed: didLapse } = await markRenewalFailed(sub, "no saved card token");
        if (didLapse) lapsed++;
        else pastDue++;
        continue;
      }

      const result = await chargeToken({
        cardToken,
        amountMinor: sub.priceMinor,
        description: `חידוש מנוי ${PLANS[sub.plan].name} — Allura`,
      });

      if (result.ok) {
        await confirmSubscriptionPayment(sub, {
          transactionId: result.transactionId,
          cardSuffix: result.cardSuffix,
        });
        renewed++;
      } else {
        const { lapsed: didLapse } = await markRenewalFailed(sub, result.error ?? "charge failed");
        if (didLapse) lapsed++;
        else pastDue++;
      }
    } catch (err) {
      captureError("cron.subscription-renewals", err, { subscriptionId: sub.id });
      pastDue++;
    }
  }

  logger.info("[cron.subscription-renewals] done", { renewed, pastDue, lapsed });
  return NextResponse.json({
    processed: due.length,
    renewed,
    pastDue,
    lapsed,
    graceDays: RENEWAL_GRACE_DAYS,
  });
}
