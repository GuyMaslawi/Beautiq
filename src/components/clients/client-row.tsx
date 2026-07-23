import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { ClientListItem } from "@/server/clients/queries";
import type { ClientLoyaltyBadge } from "@/server/loyalty/queries";
import { CLIENTS, ACTIONS, LOYALTY } from "@/lib/constants/he";
import { WhatsAppManualSendModal } from "@/components/clients/whatsapp-manual-send-modal";

/** Small loyalty progress / eligibility pill shown next to a client's name. */
export function LoyaltyPill({ loyalty }: { loyalty: ClientLoyaltyBadge }) {
  const eligible = loyalty.pendingRewards > 0;
  return (
    <span
      className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
      style={
        eligible
          ? { background: "rgba(172,92,127,0.14)", color: "#ac5c7f" }
          : { background: "rgba(172,92,127,0.07)", color: "#8a5a72" }
      }
    >
      {eligible
        ? LOYALTY.badge.eligible
        : LOYALTY.badge.progress(loyalty.visitsInCurrentCard, loyalty.visitsRequired)}
    </span>
  );
}

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
  if (dayDiff < 30) return `לפני ${Math.round(dayDiff / 7)} שבועות`;
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
      weekday: "short",
      day: "numeric",
      month: "numeric",
    }) + ` · ${time}`
  );
}

export function ClientRow({
  client,
  businessName,
  isTestMode,
  loyalty = null,
}: {
  client: ClientListItem;
  businessName: string;
  isTestMode: boolean;
  /** Loyalty progress for this client, when the program is active. */
  loyalty?: ClientLoyaltyBadge | null;
}) {
  const initials = client.fullName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  const isNew = !client.lastVisitAt || (() => {
    const daysSince = Math.floor(
      (new Date().getTime() - new Date(client.lastVisitAt!).getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysSince < 30;
  })();

  return (
    <tr
      className="group border-b transition-colors hover:bg-[rgba(247,238,243,0.35)]"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Client name + phone */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #c76f93 0%, #ac5c7f 100%)",
              boxShadow: "0 2px 6px rgba(172,92,127,0.25)",
            }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-foreground text-sm font-semibold leading-tight truncate">
                {client.fullName}
              </p>
              {isNew && (
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: "rgba(192,149,96,0.14)", color: "#8a6430" }}
                >
                  חדש
                </span>
              )}
              {loyalty && <LoyaltyPill loyalty={loyalty} />}
            </div>
            <p className="text-xs mt-0.5" dir="ltr" style={{ color: "var(--muted)", textAlign: "right" }}>
              {client.phone}
            </p>
          </div>
        </div>
      </td>

      {/* Last visit + upcoming */}
      <td className="px-4 py-3">
        <div className="space-y-1">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {CLIENTS.card.lastVisit}:{" "}
            <span className="font-medium" style={{ color: "var(--foreground-soft)" }}>
              {client.lastVisitAt ? formatLastVisit(client.lastVisitAt) : CLIENTS.card.noVisitYet}
            </span>
          </p>
          {client.upcomingBooking ? (
            <p className="text-xs font-medium" style={{ color: "#8a3d60" }}>
              ← {formatUpcomingDate(client.upcomingBooking.startTime)}
            </p>
          ) : (
            <p className="text-xs" style={{ color: "var(--muted-light)" }}>אין תור קרוב</p>
          )}
        </div>
      </td>

      {/* Total bookings */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <span className="text-sm font-semibold" style={{ color: "var(--foreground-soft)" }}>
          {client.totalBookings}
        </span>
        <p className="text-[10px]" style={{ color: "var(--muted)" }}>הזמנות</p>
      </td>

      {/* History: no-shows + cancellations */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {client.noShowCount > 0 && (
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background: "rgba(190,74,74,0.09)",
                color: "#8b2e2e",
                border: "1px solid rgba(190,74,74,0.18)",
              }}
            >
              <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
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
          {client.noShowCount === 0 && client.cancellationCount === 0 && (
            <span className="text-xs" style={{ color: "var(--muted-light)" }}>—</span>
          )}
        </div>
      </td>

      {/* Total spent */}
      <td className="px-4 py-3 whitespace-nowrap">
        {client.totalSpent > 0 ? (
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--foreground-soft)" }}>
              ₪{client.totalSpent.toLocaleString("he-IL")}
            </p>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>
              סה״כ הוצאה
            </p>
          </div>
        ) : (
          <span className="text-sm" style={{ color: "var(--muted-light)" }}>—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/clients/${client.id}`}
            className="flex h-7 items-center rounded-lg border px-2.5 text-xs font-medium transition-all hover:shadow-sm"
            style={{
              borderColor: "var(--border)",
              color: "var(--foreground-soft)",
              background: "var(--surface)",
            }}
          >
            {CLIENTS.card.detailsButton}
          </Link>
          <Link
            href={`/clients/${client.id}`}
            className="flex h-7 items-center rounded-lg border px-2.5 text-xs font-medium transition-all hover:shadow-sm"
            style={{
              borderColor: "var(--border)",
              color: "var(--foreground-soft)",
              background: "var(--surface)",
            }}
          >
            {ACTIONS.edit}
          </Link>
          <WhatsAppManualSendModal
            clientId={client.id}
            clientName={client.fullName}
            clientPhone={client.phone}
            businessName={businessName}
            isTestMode={isTestMode}
            trigger={
              <button
                type="button"
                className="flex h-7 items-center rounded-lg border px-2.5 text-xs font-medium transition-all hover:shadow-sm"
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
          <Link
            href={`/bookings/new?clientId=${client.id}`}
            className="flex h-7 items-center rounded-lg px-2.5 text-xs font-semibold transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #c76f93 0%, #ac5c7f 100%)",
              color: "#fff",
              boxShadow: "0 1px 4px rgba(172,92,127,0.22)",
            }}
          >
            + תור
          </Link>
        </div>
      </td>
    </tr>
  );
}
