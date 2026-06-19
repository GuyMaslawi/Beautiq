import Link from "next/link";
import { CalendarDays, Phone, ShoppingBag, AlertTriangle } from "lucide-react";
import type { ClientListItem } from "@/server/clients/queries";
import { CLIENTS } from "@/lib/constants/he";
import { WhatsAppManualSendModal } from "@/components/clients/whatsapp-manual-send-modal";

function formatLastVisit(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const visitDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.floor(
    (todayStart.getTime() - visitDay.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (dayDiff === 0) return "היום";
  if (dayDiff === 1) return "אתמול";
  if (dayDiff < 7) return `לפני ${dayDiff} ימים`;
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "long" });
}

function formatUpcomingDate(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const bookingDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const time = d.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (bookingDay.getTime() === todayStart.getTime()) return `היום · ${time}`;
  if (bookingDay.getTime() === tomorrowStart.getTime()) return `מחר · ${time}`;

  return (
    d.toLocaleDateString("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }) + ` · ${time}`
  );
}

export function ClientCard({
  client,
  businessName,
  isTestMode = false,
}: {
  client: ClientListItem;
  businessName?: string;
  isTestMode?: boolean;
}) {
  const initials = client.fullName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  const hasWarnings = client.noShowCount > 0 || client.cancellationCount > 0;

  return (
    <div
      className="overflow-hidden rounded-2xl border transition-shadow hover:shadow-md"
      style={{
        background: "#fff",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-start gap-4 p-5">
        {/* Avatar */}
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{
            background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
            boxShadow: "0 2px 6px rgba(184,107,140,0.25)",
          }}
        >
          {initials}
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">

          {/* Name row */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-foreground text-base font-bold leading-tight">
                {client.fullName}
              </p>
              {/* Phone — always below the name, with dir=ltr to render correctly */}
              <p
                className="mt-0.5 text-sm"
                dir="ltr"
                style={{ color: "var(--muted)", textAlign: "right" }}
              >
                {client.phone}
              </p>
            </div>

            {/* Warnings */}
            {hasWarnings && (
              <div className="flex shrink-0 items-center gap-1.5">
                {client.noShowCount > 0 && (
                  <span
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      background: "rgba(190,74,74,0.09)",
                      color: "#8b2e2e",
                      border: "1px solid rgba(190,74,74,0.18)",
                    }}
                  >
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {CLIENTS.card.noShow}: {client.noShowCount}
                  </span>
                )}
                {client.cancellationCount > 0 && (
                  <span
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      background: "rgba(184,150,10,0.09)",
                      color: "#7a6400",
                      border: "1px solid rgba(184,150,10,0.18)",
                    }}
                  >
                    {CLIENTS.card.cancellations}: {client.cancellationCount}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">

            {/* Last visit */}
            <span
              className="flex items-center gap-1.5 text-xs"
              style={{ color: "var(--muted)" }}
            >
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>
                {CLIENTS.card.lastVisit}:{" "}
                <span className="font-medium" style={{ color: "var(--foreground-soft)" }}>
                  {client.lastVisitAt
                    ? formatLastVisit(client.lastVisitAt)
                    : CLIENTS.card.noVisitYet}
                </span>
              </span>
            </span>

            {/* Total bookings */}
            <span
              className="flex items-center gap-1.5 text-xs"
              style={{ color: "var(--muted)" }}
            >
              <Phone className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <span>
                {client.totalBookings} {CLIENTS.card.totalBookings}
              </span>
            </span>

            {/* Total spent */}
            {client.totalSpent > 0 && (
              <span
                className="flex items-center gap-1.5 text-xs"
                style={{ color: "var(--muted)" }}
              >
                <ShoppingBag className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span>
                  {CLIENTS.card.totalSpent}: ₪
                  {client.totalSpent.toLocaleString("he-IL")}
                </span>
              </span>
            )}
          </div>

          {/* Upcoming booking */}
          {client.upcomingBooking && (
            <div
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{
                background: "rgba(184,107,140,0.09)",
                color: "#8a3d60",
                border: "1px solid rgba(184,107,140,0.18)",
              }}
            >
              <CalendarDays className="h-3 w-3 shrink-0" />
              {formatUpcomingDate(client.upcomingBooking.startTime)}
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div
        className="flex items-center gap-2 px-5 py-3"
        style={{ borderTop: "1px solid var(--border)", background: "rgba(43,37,48,0.02)" }}
      >
        <Link
          href={`/clients/${client.id}`}
          className="flex h-8 cursor-pointer items-center rounded-xl border px-3 text-xs font-medium transition-all hover:shadow-sm"
          style={{
            borderColor: "var(--border)",
            color: "var(--foreground-soft)",
            background: "var(--surface)",
          }}
        >
          {CLIENTS.card.detailsButton}
        </Link>
        {businessName && (
          <WhatsAppManualSendModal
            clientId={client.id}
            clientName={client.fullName}
            clientPhone={client.phone}
            businessName={businessName}
            isTestMode={isTestMode}
            trigger={
              <button
                type="button"
                className="flex h-8 cursor-pointer items-center rounded-xl border px-3 text-xs font-medium transition-all hover:shadow-sm"
                style={{
                  borderColor: "rgba(22,163,74,0.30)",
                  color: "#16a34a",
                  background: "rgba(22,163,74,0.06)",
                }}
              >
                WhatsApp
              </button>
            }
          />
        )}
        <Link
          href={`/bookings/new?clientId=${client.id}`}
          className="ms-auto flex h-8 cursor-pointer items-center rounded-xl px-3 text-xs font-semibold transition-opacity hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
            color: "#fff",
            boxShadow: "0 1px 4px rgba(184,107,140,0.22)",
          }}
        >
          {CLIENTS.card.newBookingButton}
        </Link>
      </div>
    </div>
  );
}
