import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCurrentBusiness } from "@/server/auth/session";
import { getClientDetail } from "@/server/clients/queries";
import { updateClientNotesAction } from "@/server/clients/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientNotesForm } from "@/components/clients/client-notes-form";
import { ClientBookingHistory } from "@/components/clients/client-booking-history";
import { ClientSmartMessagesCard } from "@/components/messages/client-smart-messages-card";
import { ClientRetentionCard } from "@/components/retention/client-retention-card";
import { ClientReputationCard } from "@/components/reputation/client-reputation-card";
import { getClientLatestCompletedBooking } from "@/server/reputation/queries";
import { CLIENTS } from "@/lib/constants/he";
import { ClientOptInForm } from "@/components/clients/client-opt-in-form";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

function getClientStatus(stats: {
  totalBookings: number;
  noShowCount: number;
  lastVisitAt: Date | null;
  upcomingBooking: { startTime: Date } | null;
}): { label: string; className: string } {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  if (stats.noShowCount > 0) {
    return {
      label: CLIENTS.detail.statusHasNoShow,
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  const notReturnedRecently =
    stats.lastVisitAt !== null &&
    new Date(stats.lastVisitAt) < thirtyDaysAgo &&
    !stats.upcomingBooking;

  if (notReturnedRecently) {
    return {
      label: CLIENTS.detail.statusNotReturned,
      className: "border-orange-200 bg-orange-50 text-orange-700",
    };
  }

  if (stats.totalBookings === 0) {
    return {
      label: CLIENTS.detail.statusNew,
      className: "border-border bg-surface text-muted",
    };
  }

  return {
    label: CLIENTS.detail.statusActive,
    className: "border-green-200 bg-green-50 text-green-700",
  };
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };
  const [client, recentReputationBooking] = await Promise.all([
    getClientDetail(tenant, clientId),
    getClientLatestCompletedBooking(tenant, clientId),
  ]);

  if (!client) notFound();

  const notesAction = updateClientNotesAction.bind(null, clientId);
  const { stats } = client;

  // Most recent completed booking for message context
  const recentCompletedBooking =
    client.bookings.find((b) => b.status === "completed") ?? null;

  const status = getClientStatus(stats);

  // Build simple insight tags
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const insights: string[] = [];
  if (stats.totalBookings === 0) {
    insights.push(CLIENTS.detail.insightNoBookings);
  } else {
    if (stats.upcomingBooking) insights.push(CLIENTS.detail.insightHasUpcoming);
    if (stats.noShowCount > 0) insights.push(CLIENTS.detail.insightHasNoShow);
    if (stats.cancellationCount > 0)
      insights.push(CLIENTS.detail.insightHasCancellations);
    if (
      stats.lastVisitAt !== null &&
      new Date(stats.lastVisitAt) < thirtyDaysAgo &&
      !stats.upcomingBooking
    ) {
      insights.push(CLIENTS.detail.insightNotReturned);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {/* Back */}
      <div>
        <Link href="/clients">
          <Button variant="ghost" size="sm" className="text-muted -ms-2">
            → {CLIENTS.detail.backLink}
          </Button>
        </Link>
      </div>

      {/* Profile summary card */}
      <Card className="space-y-4 p-5">
        {/* Name + status chip + new booking */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-foreground text-xl font-bold leading-tight">
              {client.fullName}
            </h1>
            <p className="text-muted mt-0.5 text-sm" dir="ltr">
              {client.phone}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span
              className={`rounded-full border px-3 py-0.5 text-xs font-medium ${status.className}`}
            >
              {status.label}
            </span>
            <Link href={`/bookings/new?clientId=${client.id}`}>
              <Button size="sm">{CLIENTS.detail.newBookingButton}</Button>
            </Link>
          </div>
        </div>

        <div className="border-border border-t" />

        {/* Key stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="text-center">
            <p className="text-foreground text-xl font-bold tabular-nums">
              {stats.totalBookings}
            </p>
            <p className="text-muted mt-0.5 text-xs">
              {CLIENTS.detail.totalBookings}
            </p>
          </div>
          <div className="text-center">
            <p className="text-foreground text-xl font-bold tabular-nums">
              {stats.totalSpent > 0
                ? `₪${stats.totalSpent.toLocaleString("he-IL")}`
                : "—"}
            </p>
            <p className="text-muted mt-0.5 text-xs">
              {CLIENTS.detail.totalSpent}
            </p>
          </div>
          <div className="text-center">
            <p
              className={`text-xl font-bold tabular-nums ${stats.noShowCount > 0 ? "text-red-600" : "text-foreground"}`}
            >
              {stats.noShowCount}
            </p>
            <p className="text-muted mt-0.5 text-xs">
              {CLIENTS.detail.noShowCount}
            </p>
          </div>
          <div className="text-center">
            <p
              className={`text-xl font-bold tabular-nums ${stats.cancellationCount > 0 ? "text-orange-600" : "text-foreground"}`}
            >
              {stats.cancellationCount}
            </p>
            <p className="text-muted mt-0.5 text-xs">
              {CLIENTS.detail.cancellationCount}
            </p>
          </div>
        </div>

        <div className="border-border border-t" />

        {/* Last visit + upcoming */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted text-sm">{CLIENTS.detail.lastVisit}</span>
            <span className="text-foreground text-sm font-medium">
              {stats.lastVisitAt
                ? formatDate(stats.lastVisitAt)
                : CLIENTS.detail.noVisitYet}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted text-sm">
              {CLIENTS.detail.upcomingBooking}
            </span>
            <span className="text-foreground text-sm font-medium">
              {stats.upcomingBooking
                ? formatUpcomingDate(stats.upcomingBooking.startTime)
                : CLIENTS.detail.noUpcoming}
            </span>
          </div>
        </div>
      </Card>

      {/* Client insights */}
      {insights.length > 0 && (
        <Card className="p-5">
          <p className="text-muted mb-3 text-xs font-semibold uppercase tracking-wider">
            {CLIENTS.detail.insightsSection}
          </p>
          <div className="flex flex-wrap gap-2">
            {insights.map((insight) => (
              <span
                key={insight}
                className="bg-background text-foreground rounded-full border px-3 py-1 text-xs"
              >
                {insight}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Contact details */}
      <Card className="space-y-0 p-5">
        <p className="text-muted mb-3 text-xs font-semibold uppercase tracking-wider">
          {CLIENTS.detail.contactSection}
        </p>
        <div className="space-y-0">
          <div className="flex items-center justify-between gap-4 py-2">
            <span className="text-muted text-sm">{CLIENTS.detail.name}</span>
            <span className="text-foreground text-sm font-medium">
              {client.fullName}
            </span>
          </div>
          <div className="border-border border-t" />
          <div className="flex items-center justify-between gap-4 py-2">
            <span className="text-muted text-sm">{CLIENTS.detail.phone}</span>
            <span className="text-foreground text-sm font-medium" dir="ltr">
              {client.phone}
            </span>
          </div>
          {client.email && (
            <>
              <div className="border-border border-t" />
              <div className="flex items-center justify-between gap-4 py-2">
                <span className="text-muted text-sm">{CLIENTS.detail.email}</span>
                <span className="text-foreground text-sm font-medium" dir="ltr">
                  {client.email}
                </span>
              </div>
            </>
          )}
          <div className="border-border border-t" />
          <div className="flex items-center justify-between gap-4 py-2">
            <span className="text-muted text-sm">
              {CLIENTS.detail.memberSince}
            </span>
            <span className="text-muted text-sm">
              {formatDate(client.createdAt)}
            </span>
          </div>
        </div>
      </Card>

      {/* WhatsApp opt-in */}
      <Card className="p-5">
        <ClientOptInForm
          clientId={client.id}
          whatsappOptIn={client.whatsappOptIn}
          marketingOptIn={client.marketingOptIn}
        />
      </Card>

      {/* Notes */}
      <Card className="p-5">
        <p className="text-muted mb-1 text-xs font-semibold uppercase tracking-wider">
          {CLIENTS.detail.notesSection}
        </p>
        <p className="text-muted mb-4 text-xs leading-5">
          {CLIENTS.detail.notesHelper}
        </p>
        <ClientNotesForm
          action={notesAction}
          initialNotes={client.notes ?? ""}
        />
      </Card>

      {/* Booking history */}
      <Card className="p-5">
        <p className="text-muted mb-3 text-xs font-semibold uppercase tracking-wider">
          {CLIENTS.detail.historySection}
        </p>
        <ClientBookingHistory clientId={client.id} bookings={client.bookings} />
      </Card>

      {/* Retention card — shown when client hasn't returned in 30+ days */}
      {stats.lastVisitAt !== null &&
        new Date(stats.lastVisitAt) < thirtyDaysAgo &&
        !stats.upcomingBooking && (
          <ClientRetentionCard
            clientName={client.fullName}
            businessName={business.name}
            lastServiceName={recentCompletedBooking?.service.name}
          />
        )}

      {/* Reputation card — shown when client has a recently completed booking */}
      {recentReputationBooking && (
        <ClientReputationCard
          clientName={client.fullName}
          serviceName={recentReputationBooking.serviceName}
          businessName={business.name}
          isToday={recentReputationBooking.isToday}
        />
      )}

      {/* Smart WhatsApp messages */}
      <ClientSmartMessagesCard
        businessName={business.name}
        clientName={client.fullName}
        recentBookingServiceName={recentCompletedBooking?.service.name}
        recentBookingDate={
          recentCompletedBooking
            ? new Date(recentCompletedBooking.startTime).toLocaleDateString("he-IL", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            : undefined
        }
        recentBookingTime={
          recentCompletedBooking
            ? new Date(recentCompletedBooking.startTime).toLocaleTimeString("he-IL", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })
            : undefined
        }
        hasNoShow={stats.noShowCount > 0}
        notReturnedRecently={
          stats.lastVisitAt !== null &&
          new Date(stats.lastVisitAt) < thirtyDaysAgo &&
          !stats.upcomingBooking
        }
      />
    </div>
  );
}
