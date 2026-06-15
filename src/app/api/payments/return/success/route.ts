/**
 * Customer return URL after a (claimed) successful payment.
 *
 *   GET /api/payments/return/success?bp=<bookingPaymentId>
 *
 * IMPORTANT: a client redirect is NOT proof of payment — the real confirmation
 * arrives via the provider webhook. This route only forwards the customer back
 * to the business's public page, which renders the booking confirmation from
 * the AUTHORITATIVE DB status (webhook-driven), never from the query param.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(req: NextRequest) {
  const bp = req.nextUrl.searchParams.get("bp") ?? "";

  // Resolve the owning business slug so the customer lands back on the public
  // page. The booking-payment id is an unguessable capability token.
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

  // Fallback: unknown token → the minimal status page (still DB-backed).
  return NextResponse.redirect(
    new URL(`/pay/status?bp=${encodeURIComponent(bp)}`, req.url),
  );
}
