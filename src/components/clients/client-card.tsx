import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ClientListItem } from "@/server/clients/queries";
import { CLIENTS } from "@/lib/constants/he";

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

export function ClientCard({ client }: { client: ClientListItem }) {
  const initials = client.fullName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <Card className="p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Avatar */}
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
              boxShadow: "0 1px 4px rgba(184,107,140,0.20)",
            }}
          >
            {initials}
          </div>

          <div className="min-w-0 flex-1">
          {/* Name + phone */}
          <p className="text-foreground text-base font-semibold leading-tight">
            {client.fullName}
          </p>
          <p className="text-muted mt-0.5 text-sm" dir="ltr">
            {client.phone}
          </p>

          {/* Stats row */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {/* Last visit */}
            <span className="text-muted">
              {CLIENTS.card.lastVisit}:{" "}
              {client.lastVisitAt
                ? formatLastVisit(client.lastVisitAt)
                : CLIENTS.card.noVisitYet}
            </span>

            {/* Upcoming booking */}
            {client.upcomingBooking && (
              <>
                <span className="text-muted opacity-40">·</span>
                <span className="flex items-center gap-1 font-medium" style={{ color: "#b86b8c" }}>
                  <CalendarDays className="h-3 w-3 shrink-0" />
                  {formatUpcomingDate(client.upcomingBooking.startTime)}
                </span>
              </>
            )}

            {/* Total bookings */}
            <span className="text-muted opacity-40">·</span>
            <span className="text-muted">
              {client.totalBookings} {CLIENTS.card.totalBookings}
            </span>

            {/* Total spent */}
            {client.totalSpent > 0 && (
              <>
                <span className="text-muted opacity-40">·</span>
                <span className="text-muted">
                  {CLIENTS.card.totalSpent}: ₪
                  {client.totalSpent.toLocaleString("he-IL")}
                </span>
              </>
            )}

            {/* No-show count */}
            {client.noShowCount > 0 && (
              <>
                <span className="text-muted opacity-40">·</span>
                <span className="text-red-600">
                  {CLIENTS.card.noShow}: {client.noShowCount}
                </span>
              </>
            )}

            {/* Cancellation count */}
            {client.cancellationCount > 0 && (
              <>
                <span className="text-muted opacity-40">·</span>
                <span className="text-orange-600">
                  {CLIENTS.card.cancellations}: {client.cancellationCount}
                </span>
              </>
            )}
          </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-2">
          <Link href={`/bookings/new?clientId=${client.id}`}>
            <Button variant="ghost" size="sm">
              {CLIENTS.card.newBookingButton}
            </Button>
          </Link>
          <Link href={`/clients/${client.id}`}>
            <Button variant="secondary" size="sm">
              {CLIENTS.card.detailsButton}
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
