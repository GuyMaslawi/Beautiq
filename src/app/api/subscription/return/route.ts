/**
 * Browser return from Grow's hosted payment page.
 *
 *   GET /api/subscription/return?sid=<subscriptionId>
 *
 * The customer's browser lands here after paying. We do NOT trust the redirect
 * itself — activation happens only in the webhook, from Grow's verified
 * server-to-server notification. Here we simply wait briefly for that webhook to
 * land and then route: → /dashboard once the subscription is active, otherwise
 * → /subscribe?pending=1 (the webhook will still activate it, and the app gate
 * re-checks on the next request).
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { AccountSubscriptionStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

function redirectTo(req: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, req.nextUrl.origin));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get("sid");
  if (!sid) return redirectTo(req, "/subscribe");

  // Grow's notification is usually near-instant; poll our own record a few times
  // so the common case lands straight in the app rather than on a pending screen.
  for (let attempt = 0; attempt < 4; attempt++) {
    const sub = await prisma.accountSubscription.findUnique({
      where: { id: sid },
      select: { status: true },
    });
    if (!sub) return redirectTo(req, "/subscribe");
    if (sub.status === AccountSubscriptionStatus.active) {
      return redirectTo(req, "/dashboard");
    }
    if (attempt < 3) await sleep(1000);
  }

  return redirectTo(req, "/subscribe?pending=1");
}
