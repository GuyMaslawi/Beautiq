import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCurrentBusiness } from "@/server/auth/session";
import { getBooking, getActiveCancellationPolicy } from "@/server/bookings/queries";
import {
  approveBookingAction,
  cancelBookingAction,
  completeBookingAction,
  noShowBookingAction,
  updateBookingNotesAction,
  markLateCancellationFeePendingAction,
  markLateCancellationFeePaidAction,
} from "@/server/bookings/actions";
import { getBookingPaymentForBooking } from "@/server/payments/settings";
import { getWaitlistMatchesForBooking } from "@/server/waitlist/queries";
import { WaitlistMatchPanel } from "@/components/waitlist/waitlist-match-panel";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { formatMinorILS } from "@/lib/payments/money";
import { PAYMENTS } from "@/lib/constants/he";
import { isLateCancellation, computeLateCancellationFee } from "@/lib/cancellation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { BookingNotesForm } from "@/components/bookings/booking-notes-form";
import { BookingActions } from "@/components/bookings/booking-actions";
import { BookingSmartMessagesCard } from "@/components/messages/booking-smart-messages-card";
import { BookingReputationCard } from "@/components/reputation/booking-reputation-card";
import { BOOKINGS } from "@/lib/constants/he";

const TZ = "Asia/Jerusalem";

function formatDetailDate(date: Date): string {
  const d = new Date(date);
  const now = new Date();

  const todayStr = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const tomorrowStr = new Date(now.getTime() + 86_400_000).toLocaleDateString(
    "en-CA",
    { timeZone: TZ },
  );
  const bookingStr = d.toLocaleDateString("en-CA", { timeZone: TZ });

  const timeStr = d.toLocaleTimeString("he-IL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (bookingStr === todayStr) return `היום · ${timeStr}`;
  if (bookingStr === tomorrowStr) return `מחר · ${timeStr}`;

  const dateStr = d.toLocaleDateString("he-IL", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${dateStr} · ${timeStr}`;
}

function formatCreatedAt(date: Date): string {
  return new Date(date).toLocaleDateString("he-IL", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatMsgDate(date: Date): string {
  return new Date(date).toLocaleDateString("he-IL", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatMsgTime(date: Date): string {
  return new Date(date).toLocaleTimeString("he-IL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isBookingToday(date: Date): boolean {
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const bookingStr = new Date(date).toLocaleDateString("en-CA", { timeZone: TZ });
  return todayStr === bookingStr;
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };
  const [booking, cancellationPolicy, onlinePayment] =
    await Promise.all([
      getBooking(tenant, bookingId),
      getActiveCancellationPolicy(tenant),
      getBookingPaymentForBooking(tenant.businessId, bookingId),
    ]);

  if (!booking) notFound();

  const approveAction = approveBookingAction.bind(null, bookingId);
  const completeAction = completeBookingAction.bind(null, bookingId);
  const cancelAction = cancelBookingAction.bind(null, bookingId);
  const noShowAction = noShowBookingAction.bind(null, bookingId);
  const notesAction = updateBookingNotesAction.bind(null, bookingId);
  const markFeePendingAction = markLateCancellationFeePendingAction.bind(null, bookingId);
  const markFeePaidAction = markLateCancellationFeePaidAction.bind(null, bookingId);

  const price = Number(booking.priceSnapshot);
  const duration = booking.durationMinutesSnapshot;

  const isCancelled =
    booking.status === "cancelled" || booking.status === "no_show";

  // When a slot frees up, surface waitlist clients who might want it. Owner-driven.
  const waitlistMatches = isCancelled
    ? await getWaitlistMatchesForBooking(tenant, {
        serviceId: booking.serviceId,
        startTime: booking.startTime,
      })
    : [];

  const cancelledAt = booking.cancelledAt ?? booking.noShowAt ?? null;
  const lateCancelled = isCancelled
    ? isLateCancellation(
        cancelledAt,
        booking.startTime,
        cancellationPolicy?.lateCancellationHours ?? null,
      )
    : null;

  const computedFee =
    lateCancelled && cancellationPolicy
      ? computeLateCancellationFee(
          cancellationPolicy.lateCancellationFeeType,
          cancellationPolicy.lateCancellationFeeAmount
            ? parseFloat(cancellationPolicy.lateCancellationFeeAmount)
            : null,
          cancellationPolicy.lateCancellationFeePercentage
            ? parseFloat(cancellationPolicy.lateCancellationFeePercentage)
            : null,
          price,
        )
      : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {/* Back navigation */}
      <div>
        <Link href="/bookings">
          <Button variant="ghost" size="sm" className="text-muted -ms-2">
            → {BOOKINGS.detail.backLink}
          </Button>
        </Link>
      </div>

      {/* Top profile card */}
      <Card className="space-y-4 p-5">
        {/* Client name + status */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-foreground text-xl font-bold leading-tight">
              {booking.client.fullName}
            </p>
            <p className="text-muted mt-0.5 text-sm">{booking.service.name}</p>
          </div>
          <BookingStatusBadge status={booking.status} />
        </div>

        <div className="border-border border-t" />

        {/* Date/time + meta */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <span className="text-muted w-4 shrink-0 text-center text-sm">📅</span>
            <span className="text-foreground text-sm font-medium">
              {formatDetailDate(booking.startTime)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted w-4 shrink-0 text-center text-sm">⏱</span>
            <span className="text-foreground text-sm">
              {duration} {BOOKINGS.card.minutesShort}
            </span>
          </div>
          {price > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-muted w-4 shrink-0 text-center text-sm">💰</span>
              <span className="text-foreground text-sm font-medium">
                {BOOKINGS.card.price}
                {price.toLocaleString("he-IL")}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Status actions */}
      <BookingActions
        status={booking.status}
        approveAction={approveAction}
        completeAction={completeAction}
        cancelAction={cancelAction}
        noShowAction={noShowAction}
      />

      {/* Notify-client prompt — a cancelled appointment must never be silent.
          Surfaces an immediate, obvious path to message the client. */}
      {isCancelled && (
        <a
          href="#notify-client"
          className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-opacity hover:opacity-90"
          style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.30)" }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
            style={{ background: "rgba(234,179,8,0.14)" }}
          >
            💬
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold" style={{ color: "#92400e" }}>
              {BOOKINGS.detail.notifyClientTitle}
            </p>
            <p className="text-xs" style={{ color: "var(--foreground-soft)" }}>
              {BOOKINGS.detail.notifyClientBody}
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold" style={{ color: "#b45309" }}>
            {BOOKINGS.detail.notifyClientAction} ←
          </span>
        </a>
      )}

      {/* Waitlist candidates — only when the slot has been freed (cancel/no-show) */}
      {isCancelled && waitlistMatches.length > 0 && (
        <WaitlistMatchPanel
          candidates={waitlistMatches}
          bookingDate={formatMsgDate(booking.startTime)}
          bookingTime={formatMsgTime(booking.startTime)}
        />
      )}

      {/* Online payment card — only when the booking has a hosted payment */}
      {onlinePayment && (
        <Card className="p-5 space-y-3">
          <p className="text-muted text-xs font-semibold uppercase tracking-wider">
            {PAYMENTS.settings.sectionTitle}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-foreground text-sm font-semibold">
              {formatMinorILS(onlinePayment.amountMinor)}
            </span>
            <PaymentStatusBadge status={onlinePayment.status} />
          </div>
        </Card>
      )}

      {/* Late cancellation card — only for cancelled/no-show bookings when policy is enabled */}
      {isCancelled && lateCancelled !== null && (
        <Card className="p-5 space-y-4">
          <p className="text-muted text-xs font-semibold uppercase tracking-wider">
            מעקב ביטול
          </p>

          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold"
            style={
              lateCancelled
                ? { background: "rgba(200,60,60,0.10)", color: "#b83232", border: "1px solid rgba(200,60,60,0.22)" }
                : { background: "rgba(61,139,110,0.09)", color: "#2a6e57", border: "1px solid rgba(61,139,110,0.22)" }
            }
          >
            {lateCancelled
              ? BOOKINGS.lateCancellation.badgeLate
              : BOOKINGS.lateCancellation.badgeOnTime}
          </span>

          {lateCancelled && computedFee != null && (
            <div className="space-y-2">
              <p className="text-sm font-medium" style={{ color: "var(--foreground-soft)" }}>
                {BOOKINGS.lateCancellation.feeLabel}: ₪{computedFee.toLocaleString("he-IL")}
              </p>
              {booking.lateCancellationFeeStatus === "paid" ? (
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
                  style={{ background: "rgba(61,139,110,0.09)", color: "#2a6e57", border: "1px solid rgba(61,139,110,0.22)" }}
                >
                  ✓ {BOOKINGS.lateCancellation.feeStatusPaid}
                </span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {!booking.lateCancellationFeeStatus && (
                    <form action={markFeePendingAction}>
                      <button
                        type="submit"
                        className="rounded-xl border px-4 py-2 text-sm font-medium transition-colors hover:bg-amber-50"
                        style={{ borderColor: "rgba(184,150,10,0.30)", color: "#7a6400" }}
                      >
                        {BOOKINGS.lateCancellation.markFeeRequired}
                      </button>
                    </form>
                  )}
                  {booking.lateCancellationFeeStatus === "pending" && (
                    <>
                      <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
                        style={{ background: "rgba(184,150,10,0.10)", color: "#7a6400", border: "1px solid rgba(184,150,10,0.22)" }}
                      >
                        {BOOKINGS.lateCancellation.feeStatusPending}
                      </span>
                      <form action={markFeePaidAction}>
                        <button
                          type="submit"
                          className="rounded-xl border px-4 py-2 text-sm font-medium transition-colors hover:bg-green-50"
                          style={{ borderColor: "rgba(61,139,110,0.30)", color: "#2a6e57" }}
                        >
                          {BOOKINGS.lateCancellation.markFeePaid}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {BOOKINGS.lateCancellation.manualNote}
          </p>
        </Card>
      )}

      {/* Client contact card */}
      <Card className="space-y-1 p-5">
        <p className="text-muted mb-3 text-xs font-semibold uppercase tracking-wider">
          {BOOKINGS.detail.contactSection}
        </p>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted text-sm">{BOOKINGS.detail.clientName}</span>
          <span className="text-foreground text-sm font-medium">
            {booking.client.fullName}
          </span>
        </div>
        <div className="border-border border-t my-2" />
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted text-sm">{BOOKINGS.detail.phone}</span>
          <span className="text-foreground text-sm font-medium" dir="ltr">
            {booking.client.phone}
          </span>
        </div>
        <div className="border-border border-t my-2" />
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted text-sm">{BOOKINGS.detail.createdAt}</span>
          <span className="text-muted text-sm">
            {formatCreatedAt(booking.createdAt)}
          </span>
        </div>
        {booking.source === "public" && (
          <>
            <div className="border-border border-t my-2" />
            <div className="flex items-center justify-end gap-4">
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ background: "rgba(184,107,140,0.08)", color: "#b86b8c" }}
              >
                {BOOKINGS.detail.sourcePublic}
              </span>
            </div>
          </>
        )}
      </Card>

      {/* Notes card */}
      <Card className="p-5">
        <p className="text-muted mb-4 text-xs font-semibold uppercase tracking-wider">
          {BOOKINGS.detail.notesLabel}
        </p>
        <BookingNotesForm
          action={notesAction}
          initialNotes={booking.notes ?? ""}
        />
      </Card>

      {/* Smart WhatsApp messages card */}
      <div id="notify-client" className="scroll-mt-4">
        <BookingSmartMessagesCard
          businessName={business.name}
          clientName={booking.client.fullName}
          clientPhone={booking.client.phone}
          serviceName={booking.service.name}
          bookingDate={formatMsgDate(booking.startTime)}
          bookingTime={formatMsgTime(booking.startTime)}
          price={price > 0 ? `₪${price.toLocaleString("he-IL")}` : undefined}
          bookingStatus={booking.status}
        />
      </div>

      {/* Reputation actions — only for completed bookings */}
      {booking.status === "completed" && (
        <BookingReputationCard
          clientName={booking.client.fullName}
          serviceName={booking.service.name}
          businessName={business.name}
          isToday={isBookingToday(booking.startTime)}
        />
      )}
    </div>
  );
}
