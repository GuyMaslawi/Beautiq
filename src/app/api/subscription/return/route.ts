/**
 * Browser return from Grow's hosted payment page.
 *
 *   GET /api/subscription/return
 *
 * The customer's browser lands here after paying. We do NOT trust the redirect
 * itself — activation happens only in the webhook, from Grow's verified
 * server-to-server notification. Here we just wait briefly for that webhook to
 * land (resolving the subscription from the signed-in session, so the success
 * URL can be a static value) and then route: → /dashboard once active, otherwise
 * → /subscribe?pending=1 (the webhook will still activate it; the app gate
 * re-checks on the next request). An optional `sid` query param is honored as a
 * fallback for the older links.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { AccountSubscriptionStatus } from "@prisma/client";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

function redirectTo(req: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, req.nextUrl.origin));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get("sid");
  const user = await getCurrentUser();

  // Resolve which subscription to watch: the signed-in user's, or an explicit sid.
  const where = user ? { userId: user.id } : sid ? { id: sid } : null;
  if (!where) return redirectTo(req, "/login");

  // Grow's notification is usually near-instant; poll our own record a few times
  // so the common case lands straight in the app rather than on a pending screen.
  for (let attempt = 0; attempt < 4; attempt++) {
    const sub = await prisma.accountSubscription.findFirst({
      where,
      select: { status: true },
    });
    if (sub?.status === AccountSubscriptionStatus.active) {
      return redirectTo(req, "/dashboard");
    }
    if (attempt < 3) await sleep(1000);
  }

  return redirectTo(req, "/subscribe?pending=1");
}
