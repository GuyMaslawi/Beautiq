/**
 * Browser return from Grow's hosted payment page.
 *
 *   GET /api/subscription/return?sid=<subscriptionId>
 *
 * The customer's browser lands here after paying. We do NOT trust the redirect
 * itself — we re-check the payment status directly with Grow
 * (getPaymentProcessInfo) and activate the plan if it is genuinely paid. This
 * makes activation robust even if the async webhook has not landed yet; both
 * paths call the same idempotent confirm.
 *
 * On success → /dashboard. If not yet confirmed → back to /subscribe (the
 * webhook will still activate it, and the gate re-checks on the next request).
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { AccountSubscriptionStatus } from "@prisma/client";
import { getPaymentProcessInfo } from "@/lib/subscription/grow";
import { confirmSubscriptionPayment } from "@/server/subscription/service";
import { logger, captureError } from "@/lib/logger";

export const dynamic = "force-dynamic";

function redirectTo(req: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, req.nextUrl.origin));
}

export async function GET(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get("sid");
  if (!sid) return redirectTo(req, "/subscribe");

  const subscription = await prisma.accountSubscription.findUnique({ where: { id: sid } });
  if (!subscription) return redirectTo(req, "/subscribe");

  // Already active (webhook won the race) → straight into the app.
  if (subscription.status === AccountSubscriptionStatus.active) {
    return redirectTo(req, "/dashboard");
  }

  if (!subscription.processId || !subscription.processToken) {
    return redirectTo(req, "/subscribe?pending=1");
  }

  try {
    const info = await getPaymentProcessInfo({
      processId: subscription.processId,
      processToken: subscription.processToken,
    });

    if (info.paid) {
      await confirmSubscriptionPayment(subscription, {
        transactionId: info.transactionId,
        cardToken: info.cardToken,
        cardSuffix: info.cardSuffix,
      });
      logger.info("[subscription.return] payment confirmed via return check", {
        subscriptionId: subscription.id,
      });
      return redirectTo(req, "/dashboard");
    }
  } catch (err) {
    captureError("subscription.return", err, { subscriptionId: subscription.id });
  }

  // Not confirmed yet — the webhook may still activate it moments later.
  return redirectTo(req, "/subscribe?pending=1");
}
