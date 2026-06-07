import Link from "next/link";
import { BadgeCheck, CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
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

export default async function ReputationPage() {
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };

  const [bookings, summary] = await Promise.all([
    getReputationBookings(tenant),
    getReputationSummary(tenant),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6" dir="rtl">
      {/* Page header */}
      <PageHeader
        icon={BadgeCheck}
        title={REPUTATION.pageTitle}
        subtitle="הכינו הודעות תודה ובקשות ביקורת אחרי טיפולים שהושלמו."
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-foreground text-2xl font-bold tabular-nums">
            {summary.recentCompletedCount}
          </p>
          <p className="text-muted mt-1 text-xs leading-tight">
            {REPUTATION.summary.recentCompleted}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-foreground text-2xl font-bold tabular-nums">
            {bookings.length}
          </p>
          <p className="text-muted mt-1 text-xs leading-tight">
            {REPUTATION.summary.thankyouReady}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-foreground text-2xl font-bold tabular-nums">
            {bookings.length}
          </p>
          <p className="text-muted mt-1 text-xs leading-tight">
            {REPUTATION.summary.reviewReady}
          </p>
        </Card>
      </div>

      {/* Booking list or empty state */}
      {bookings.length === 0 ? (
        <Card className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, rgba(201,120,152,0.12) 0%, rgba(184,107,140,0.08) 100%)",
              }}
            >
              <CalendarDays className="h-6 w-6" style={{ color: "#b86b8c" }} />
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
