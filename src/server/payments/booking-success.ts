/**
 * Public-safe booking-success state for the post-payment return page.
 *
 * The token is the BookingPayment id — an unguessable cuid that acts as a
 * capability reference (the same value already used in the provider return
 * URLs). It is resolved here against the authoritative DB record: the payment
 * status returned is the one written by the VERIFIED provider webhook, never a
 * client-supplied query param.
 *
 * What we return is deliberately minimal and public-safe: no businessId, no
 * internal booking/client ids, no provider payload, no internal notes. Just the
 * details a customer needs to see their own confirmation.
 *
 * Server-only.
 */

import { prisma } from "@/server/db/prisma";

const TZ = "Asia/Jerusalem";

/** Split a Date into Israel wall-clock { date: "YYYY-MM-DD", time: "HH:MM" }. */
function toIsraelWallClock(d: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  // en-CA renders the date as YYYY-MM-DD; hour may come back as "24" at midnight.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
  };
}

export type SuccessPaymentView = "paid" | "pending" | "failed" | "pay_at_business";

export interface PublicBookingSuccess {
  businessName: string;
  businessPhone: string | null;
  serviceName: string | null;
  /** "YYYY-MM-DD" Israel wall-clock date. */
  date: string;
  /** "HH:MM" Israel wall-clock time. */
  time: string;
  durationMinutes: number | null;
  customerName: string | null;
  customerPhone: string | null;
  /** Authoritative payment view, derived from the DB status (webhook-driven). */
  payment: SuccessPaymentView;
}

/**
 * Resolve a public-safe success state for `/b/[slug]?bookingSuccess=<token>`.
 *
 * Returns null when the token is unknown OR does not belong to `slug` — the
 * slug check keeps one business's success token from resolving on another's
 * page (multi-tenant safety).
 */
export async function getPublicBookingSuccess(
  slug: string,
  token: string,
): Promise<PublicBookingSuccess | null> {
  if (!token) return null;

  const payment = await prisma.bookingPayment.findUnique({
    where: { id: token },
    select: {
      status: true,
      business: { select: { slug: true, name: true, phone: true } },
      booking: {
        select: {
          startTime: true,
          durationMinutesSnapshot: true,
          service: { select: { name: true } },
          client: { select: { fullName: true, phone: true } },
        },
      },
    },
  });

  // Unknown token or cross-tenant token → behave as "not found".
  if (!payment || payment.business.slug !== slug) return null;

  const { date, time } = toIsraelWallClock(payment.booking.startTime);

  let view: SuccessPaymentView;
  if (payment.status === "paid") view = "paid";
  else if (["failed", "cancelled", "expired"].includes(payment.status))
    view = "failed";
  else view = "pending";

  return {
    businessName: payment.business.name,
    businessPhone: payment.business.phone ?? null,
    serviceName: payment.booking.service?.name ?? null,
    date,
    time,
    durationMinutes: payment.booking.durationMinutesSnapshot ?? null,
    customerName: payment.booking.client?.fullName ?? null,
    customerPhone: payment.booking.client?.phone ?? null,
    payment: view,
  };
}
