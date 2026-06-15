/**
 * Customer return URL after a failed / cancelled payment.
 *
 *   GET /api/payments/return/failure?bp=<bookingPaymentId>
 *
 * Forwards back to the business's public page, which renders the booking state
 * from the AUTHORITATIVE DB status (a client redirect is never trusted as proof
 * of anything). If the webhook already recorded a failure the page shows the
 * "not completed" state; if still pending it shows "still verifying".
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(req: NextRequest) {
  const bp = req.nextUrl.searchParams.get("bp") ?? "";

  const payment = bp
    ? await prisma.bookingPayment.findUnique({
        where: { id: bp },
        select: { business: { select: { slug: true } } },
      })
    : null;

  if (payment) {
    return NextResponse.redirect(
      new URL(
        `/b/${payment.business.slug}?bookingSuccess=${encodeURIComponent(bp)}`,
        req.url,
      ),
    );
  }

  return NextResponse.redirect(
    new URL(`/pay/status?bp=${encodeURIComponent(bp)}&failed=1`, req.url),
  );
}
