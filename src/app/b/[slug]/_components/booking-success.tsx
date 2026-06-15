/**
 * Post-payment booking confirmation, rendered inside the booking column of the
 * public page after the customer returns from the provider.
 *
 * The payment view is resolved server-side from the authoritative DB status —
 * this component only renders what it is handed. Three shapes:
 *   • paid / pay_at_business → full success confirmation
 *   • pending → "still verifying" with a refresh
 *   • failed → "not completed" with a way back
 */

import Link from "next/link";
import { CalendarPlus, MessageCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { PAYMENTS } from "@/lib/constants/he";
import {
  buildGoogleCalendarUrl,
  buildWhatsAppUrl,
  formatDateHebrew,
} from "@/lib/booking/success-links";
import type { PublicBookingSuccess } from "@/server/payments/booking-success";

const S = PAYMENTS.successState;

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-semibold text-[var(--foreground)] text-left" dir="auto">
        {value}
      </span>
    </div>
  );
}

export function PublicBookingSuccessView({
  slug,
  token,
  state,
  brand,
}: {
  slug: string;
  token: string;
  state: PublicBookingSuccess;
  brand: string;
}) {
  const grd = `linear-gradient(135deg, ${brand}cc 0%, ${brand} 100%)`;
  const businessHref = `/b/${slug}`;

  // ── Pending: payment not yet verified by the webhook ──────────────────────
  if (state.payment === "pending") {
    return (
      <StatusShell emoji="⏳" title={S.pendingTitle} body={S.pendingBody} brand={brand}>
        <Link
          href={`${businessHref}?bookingSuccess=${encodeURIComponent(token)}`}
          className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: grd }}
          prefetch={false}
        >
          <RefreshCw className="h-4 w-4" />
          {S.pendingRefresh}
        </Link>
        <BackLink href={businessHref} />
      </StatusShell>
    );
  }

  // ── Failed / cancelled / expired ──────────────────────────────────────────
  if (state.payment === "failed") {
    return (
      <StatusShell emoji="⚠️" title={S.failedTitle} body={S.failedBody} brand={brand}>
        <Link
          href={businessHref}
          className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: grd }}
        >
          {S.retry}
        </Link>
      </StatusShell>
    );
  }

  // ── Success (paid / pay-at-business) ──────────────────────────────────────
  const isPaid = state.payment === "paid";
  const title = isPaid ? S.titlePaid : S.titleBooked;
  const paymentValue =
    state.payment === "paid"
      ? S.paymentPaid
      : state.payment === "pay_at_business"
        ? S.paymentAtBusiness
        : S.paymentPending;

  const formattedDate = formatDateHebrew(state.date);
  const linkParams = {
    serviceName: state.serviceName,
    businessName: state.businessName,
    date: state.date,
    time: state.time,
    durationMinutes: state.durationMinutes,
    businessPhone: state.businessPhone,
  };
  const calUrl = buildGoogleCalendarUrl(linkParams);
  const waMessage = S.whatsappMessage
    .replace("{service}", state.serviceName ?? "טיפול")
    .replace("{business}", state.businessName)
    .replace("{date}", formattedDate)
    .replace("{time}", state.time);
  const waUrl = buildWhatsAppUrl(linkParams, waMessage);

  return (
    <div className="space-y-6 py-2 text-center">
      <div
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-4xl"
        style={{ background: `linear-gradient(135deg, ${brand}22, ${brand}44)` }}
      >
        {isPaid ? "🎉" : "✅"}
      </div>

      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">{title}</h2>
        <p className="text-sm text-[var(--muted)]">{S.confirmation}</p>
      </div>

      {/* Booking details */}
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5 text-right">
        <h3 className="mb-2 text-sm font-bold text-[var(--foreground)]">
          {S.detailsHeading}
        </h3>
        <div className="divide-y divide-[var(--border)]">
          <DetailRow label={S.businessLabel} value={state.businessName} />
          {state.serviceName && (
            <DetailRow label={S.serviceLabel} value={state.serviceName} />
          )}
          {formattedDate && <DetailRow label={S.dateLabel} value={formattedDate} />}
          {state.time && <DetailRow label={S.timeLabel} value={state.time} />}
          {state.customerName && (
            <DetailRow label={S.nameLabel} value={state.customerName} />
          )}
          {state.customerPhone && (
            <DetailRow label={S.phoneLabel} value={state.customerPhone} />
          )}
          <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span className="text-[var(--muted)]">{S.paymentLabel}</span>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold"
              style={{ background: `${brand}14`, color: brand }}
            >
              {paymentValue}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <a
          href={calUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: grd }}
        >
          <CalendarPlus className="h-4 w-4" />
          {S.addToCalendar}
        </a>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl border-2 py-3.5 text-sm font-bold transition-all hover:opacity-90"
          style={{ borderColor: brand, color: brand }}
        >
          <MessageCircle className="h-4 w-4" />
          {S.openWhatsApp}
        </a>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-xs text-[var(--muted)]">
        <ShieldCheck className="h-3.5 w-3.5" />
        {S.saveNote}
      </p>

      <BackLink href={businessHref} />
    </div>
  );
}

function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="block text-sm underline underline-offset-2 transition-opacity hover:opacity-75"
      style={{ color: "var(--muted)" }}
    >
      {S.backToBusiness}
    </Link>
  );
}

function StatusShell({
  emoji,
  title,
  body,
  brand,
  children,
}: {
  emoji: string;
  title: string;
  body: string;
  brand: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 py-4 text-center">
      <div
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-4xl"
        style={{ background: `linear-gradient(135deg, ${brand}18, ${brand}33)` }}
      >
        {emoji}
      </div>
      <div className="space-y-1.5">
        <h2 className="text-xl font-bold text-[var(--foreground)]">{title}</h2>
        <p className="text-sm leading-relaxed text-[var(--muted)]">{body}</p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
