import Link from "next/link";
import { BadgeCheck, CalendarDays, CheckCircle2, MessageCircle } from "lucide-react";
import { EditorialSectionHeader } from "@/components/premium";
import { requireCurrentBusiness } from "@/server/auth/session";
import {
  getReputationBookings,
  getReputationSummary,
} from "@/server/reputation/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReputationBookingCard } from "@/components/reputation/reputation-booking-card";
import { REPUTATION } from "@/lib/constants/he";
import { RECENT_COMPLETED_BOOKINGS_DAYS } from "@/lib/reputation/constants";

function formatCompletedDate(date: Date): string {
  const d = new Date(date);
  const now = new Date();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const bookingDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const time = d.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (bookingDay.getTime() === todayStart.getTime()) {
    return `היום · ${time}`;
  }

  return (
    d.toLocaleDateString("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }) + ` · ${time}`
  );
}

/** ביקורות ומוניטין — הודעות תודה ובקשות ביקורת אחרי טיפולים שהושלמו. */
export async function ReputationSection() {
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };

  const [bookings, summary] = await Promise.all([
    getReputationBookings(tenant),
    getReputationSummary(tenant),
  ]);

  return (
    <div className="w-full space-y-6" dir="rtl">
      {/* Section header */}
      <EditorialSectionHeader
        icon={<BadgeCheck className="h-4 w-4" />}
        eyebrow="מוניטין וביקורות"
        title={REPUTATION.pageTitle}
        description="הכינו הודעות תודה ובקשות ביקורת אחרי טיפולים שהושלמו."
        tint="plum"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* הושלמו לאחרונה */}
        <div
          className="rounded-2xl px-3.5 py-3.5 transition-shadow hover:shadow-md sm:px-5 sm:py-4"
          style={{
            background: summary.recentCompletedCount > 0 ? "rgba(247,238,243,0.85)" : "rgba(255,255,255,0.90)",
            border: `1px solid ${summary.recentCompletedCount > 0 ? "rgba(172,92,127,0.22)" : "var(--border)"}`,
            boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
          }}
        >
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: summary.recentCompletedCount > 0 ? "rgba(172,92,127,0.13)" : "rgba(172,92,127,0.08)" }}
          >
            <CheckCircle2 className="h-4 w-4" style={{ color: "#ac5c7f" }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: summary.recentCompletedCount > 0 ? "#ac5c7f" : "#2b2530" }}>
            {summary.recentCompletedCount}
          </p>
          <p className="mt-1 text-xs font-medium leading-tight" style={{ color: "#8a8190" }}>
            {REPUTATION.summary.recentCompleted}
          </p>
        </div>

        {/* מוכנים להודעת תודה */}
        <div
          className="rounded-2xl px-3.5 py-3.5 transition-shadow hover:shadow-md sm:px-5 sm:py-4"
          style={{
            background: "rgba(255,255,255,0.90)",
            border: "1px solid var(--border)",
            boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
          }}
        >
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: "rgba(172,92,127,0.08)" }}
          >
            <MessageCircle className="h-4 w-4" style={{ color: "#ac5c7f" }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: "#2b2530" }}>
            {bookings.length}
          </p>
          <p className="mt-1 text-xs font-medium leading-tight" style={{ color: "#8a8190" }}>
            {REPUTATION.summary.thankyouReady}
          </p>
        </div>

        {/* מוכנים לבקשת ביקורת */}
        <div
          className="rounded-2xl px-3.5 py-3.5 transition-shadow hover:shadow-md sm:px-5 sm:py-4"
          style={{
            background: "rgba(255,255,255,0.90)",
            border: "1px solid var(--border)",
            boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
          }}
        >
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: "rgba(172,92,127,0.08)" }}
          >
            <BadgeCheck className="h-4 w-4" style={{ color: "#ac5c7f" }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: "#2b2530" }}>
            {bookings.length}
          </p>
          <p className="mt-1 text-xs font-medium leading-tight" style={{ color: "#8a8190" }}>
            {REPUTATION.summary.reviewReady}
          </p>
        </div>
      </div>

      {/* Booking list or empty state */}
      {bookings.length === 0 ? (
        <Card className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, rgba(199,111,147,0.12) 0%, rgba(172,92,127,0.08) 100%)",
              }}
            >
              <CalendarDays className="h-6 w-6" style={{ color: "#ac5c7f" }} />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">
              {REPUTATION.emptyState.title}
            </h2>
            <p className="text-muted text-sm leading-relaxed max-w-sm mx-auto">
              {REPUTATION.emptyState.body}
            </p>
            <p className="text-muted text-xs">
              מציג טיפולים שהושלמו ב־{RECENT_COMPLETED_BOOKINGS_DAYS} הימים האחרונים
            </p>
          </div>
          <Link href={REPUTATION.emptyState.ctaHref}>
            <Button variant="secondary" size="sm">
              {REPUTATION.emptyState.cta}
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <ReputationBookingCard
              key={booking.id}
              booking={booking}
              businessName={business.name}
              completedDateFormatted={formatCompletedDate(booking.completedAt)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
