import Link from "next/link";
import { CalendarDays, AlertTriangle } from "lucide-react";
import type { ClientListItem } from "@/server/clients/queries";
import type { ClientLoyaltyBadge } from "@/server/loyalty/queries";
import { CLIENTS } from "@/lib/constants/he";
import { WhatsAppManualSendModal } from "@/components/clients/whatsapp-manual-send-modal";
import { ClientAuraCard } from "@/components/premium/client-aura-card";
import { LoyaltyPill } from "@/components/clients/client-row";

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
  loyalty = null,
}: {
  client: ClientListItem;
  businessName?: string;
  isTestMode?: boolean;
  /** Loyalty progress for this client, when the program is active. */
  loyalty?: ClientLoyaltyBadge | null;
}) {
  const initials = client.fullName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  const actionBtn =
    "flex h-8 cursor-pointer items-center rounded-xl border px-3 text-xs font-medium transition-all hover:shadow-sm";

  return (
    <ClientAuraCard
      name={client.fullName}
      contact={client.phone}
      initials={initials}
      statusTone={client.upcomingBooking ? "success" : client.noShowCount > 0 ? "danger" : "brand"}
      statusLabel={client.upcomingBooking ? "תור קרוב" : client.noShowCount > 0 ? "לא הגיעה" : undefined}
      statusDot={!!client.upcomingBooking}
      badges={
        (client.noShowCount > 0 || client.cancellationCount > 0 || loyalty) && (
          <>
            {loyalty && <LoyaltyPill loyalty={loyalty} />}
            {client.noShowCount > 0 && (
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: "rgba(190,74,74,0.09)", color: "#8b2e2e", border: "1px solid rgba(190,74,74,0.18)" }}
              >
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {CLIENTS.card.noShow}: {client.noShowCount}
              </span>
            )}
            {client.cancellationCount > 0 && (
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: "rgba(184,150,10,0.09)", color: "#7a6400", border: "1px solid rgba(184,150,10,0.18)" }}
              >
                {CLIENTS.card.cancellations}: {client.cancellationCount}
              </span>
            )}
          </>
        )
      }
      stats={[
        {
          label: CLIENTS.card.lastVisit,
          value: client.lastVisitAt ? formatLastVisit(client.lastVisitAt) : "—",
        },
        { label: CLIENTS.card.totalBookings, value: client.totalBookings },
        {
          label: CLIENTS.card.totalSpent,
          value: client.totalSpent > 0 ? `₪${client.totalSpent.toLocaleString("he-IL")}` : "—",
        },
      ]}
      highlight={
        client.upcomingBooking && (
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: "rgba(172,92,127,0.09)", color: "#8a3d60", border: "1px solid rgba(172,92,127,0.18)" }}
          >
            <CalendarDays className="h-3 w-3 shrink-0" />
            {formatUpcomingDate(client.upcomingBooking.startTime)}
          </div>
        )
      }
      actions={
        <>
          <Link
            href={`/clients/${client.id}`}
            className={actionBtn}
            style={{ borderColor: "var(--border)", color: "var(--foreground-soft)", background: "var(--surface)" }}
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
                  className={actionBtn}
                  style={{ borderColor: "rgba(22,163,74,0.30)", color: "#16a34a", background: "rgba(22,163,74,0.06)" }}
                >
                  WhatsApp
                </button>
              }
            />
          )}
          <Link
            href={`/bookings/new?clientId=${client.id}`}
            className="ms-auto flex h-8 cursor-pointer items-center rounded-xl px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #c76f93 0%, #ac5c7f 100%)", boxShadow: "0 1px 4px rgba(172,92,127,0.22)" }}
          >
            {CLIENTS.card.newBookingButton}
          </Link>
        </>
      }
    />
  );
}
