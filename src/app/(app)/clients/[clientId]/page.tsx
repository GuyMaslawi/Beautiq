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
import { getClientLoyaltyStatus } from "@/server/loyalty/queries";
import { ClientLoyaltyCard } from "@/components/loyalty/client-loyalty-card";
import { CLIENTS } from "@/lib/constants/he";
import { ClientEditModal } from "@/components/clients/client-edit-modal";
import { WhatsAppManualSendModal } from "@/components/clients/whatsapp-manual-send-modal";
import { ArrowRight, CalendarClock, History, ShoppingBag, UserX, XCircle, MessageCircle } from "lucide-react";
import { PremiumPageShell } from "@/components/premium/page-shell";
import { PremiumMetricCard } from "@/components/premium/metric-card";
import { LuxuryStatusPill } from "@/components/premium/status-pill";
import type { ToneKey } from "@/components/premium/tokens";

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
}): { label: string; tone: ToneKey } {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  if (stats.noShowCount > 0) {
    return { label: CLIENTS.detail.statusHasNoShow, tone: "danger" };
  }

  const notReturnedRecently =
    stats.lastVisitAt !== null &&
    new Date(stats.lastVisitAt) < thirtyDaysAgo &&
    !stats.upcomingBooking;

  if (notReturnedRecently) {
    return { label: CLIENTS.detail.statusNotReturned, tone: "warning" };
  }

  if (stats.totalBookings === 0) {
    return { label: CLIENTS.detail.statusNew, tone: "neutral" };
  }

  return { label: CLIENTS.detail.statusActive, tone: "success" };
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };
  const [client, recentReputationBooking, loyaltyStatus] = await Promise.all([
    getClientDetail(tenant, clientId),
    getClientLatestCompletedBooking(tenant, clientId),
    getClientLoyaltyStatus(tenant, clientId),
  ]);

  if (!client) notFound();

  const notesAction = updateClientNotesAction.bind(null, clientId);
  const { stats } = client;
  const isTestMode = process.env.WHATSAPP_TEST_MODE === "true";

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

  const initials = client.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("");

  return (
    <PremiumPageShell tint="rose" width="narrow">
      {/* Back */}
      <div>
        <Link href="/clients">
          <Button variant="ghost" size="sm" className="text-muted -ms-2">
            <ArrowRight className="me-1 h-4 w-4" />
            {CLIENTS.detail.backLink}
          </Button>
        </Link>
      </div>

      {/* ── Identity band ── */}
      <div className="aura-card relative overflow-hidden rounded-[1.6rem] p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 h-44 w-44 rounded-full"
          style={{ insetInlineEnd: "-2rem", background: "radial-gradient(circle, rgba(199,111,147,0.2) 0%, transparent 70%)", filter: "blur(16px)" }}
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span
              className="ring-soft flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white"
              style={{ background: "linear-gradient(135deg,#c76f93,#92609f)", boxShadow: "0 12px 28px -8px rgba(172,92,127,0.6)" }}
            >
              {initials}
            </span>
            <div className="min-w-0">
              <div className="mb-1.5">
                <LuxuryStatusPill tone={status.tone} variant="soft" dot={status.tone === "success"}>
                  {status.label}
                </LuxuryStatusPill>
              </div>
              <h1 className="display-num text-foreground text-2xl font-bold leading-tight">{client.fullName}</h1>
              <p className="text-muted mt-0.5 text-sm" dir="ltr">{client.phone}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <WhatsAppManualSendModal
              clientId={client.id}
              clientName={client.fullName}
              clientPhone={client.phone}
              businessName={business.name}
              isTestMode={isTestMode}
              trigger={
                <button
                  type="button"
                  className="flex h-9 items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold transition-all hover:shadow-sm"
                  style={{ borderColor: "rgba(22,163,74,0.30)", color: "#16a34a", background: "rgba(22,163,74,0.06)" }}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  שליחת WhatsApp
                </button>
              }
            />
            <Link href={`/bookings/new?clientId=${client.id}`}>
              <Button size="sm">{CLIENTS.detail.newBookingButton}</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Key stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PremiumMetricCard
          label={CLIENTS.detail.totalBookings}
          count={stats.totalBookings}
          icon={<History className="h-4 w-4" />}
        />
        <PremiumMetricCard
          label={CLIENTS.detail.totalSpent}
          count={stats.totalSpent > 0 ? `₪${stats.totalSpent.toLocaleString("he-IL")}` : "—"}
          icon={<ShoppingBag className="h-4 w-4" />}
          tone={stats.totalSpent > 0 ? "success" : "neutral"}
        />
        <PremiumMetricCard
          label={CLIENTS.detail.noShowCount}
          count={stats.noShowCount}
          icon={<UserX className="h-4 w-4" />}
          tone={stats.noShowCount > 0 ? "danger" : "neutral"}
        />
        <PremiumMetricCard
          label={CLIENTS.detail.cancellationCount}
          count={stats.cancellationCount}
          icon={<XCircle className="h-4 w-4" />}
          tone={stats.cancellationCount > 0 ? "warning" : "neutral"}
        />
      </div>

      {/* ── Last visit + upcoming ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="aura-card flex items-center gap-3 rounded-[1.2rem] p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(172,92,127,0.1)", color: "#ac5c7f" }}>
            <History className="h-5 w-5" />
          </span>
          <div>
            <p className="text-muted text-xs">{CLIENTS.detail.lastVisit}</p>
            <p className="text-foreground text-sm font-bold">
              {stats.lastVisitAt ? formatDate(stats.lastVisitAt) : CLIENTS.detail.noVisitYet}
            </p>
          </div>
        </div>
        <div className="aura-card flex items-center gap-3 rounded-[1.2rem] p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(61,139,110,0.1)", color: "#3d8b6e" }}>
            <CalendarClock className="h-5 w-5" />
          </span>
          <div>
            <p className="text-muted text-xs">{CLIENTS.detail.upcomingBooking}</p>
            <p className="text-foreground text-sm font-bold">
              {stats.upcomingBooking ? formatUpcomingDate(stats.upcomingBooking.startTime) : CLIENTS.detail.noUpcoming}
            </p>
          </div>
        </div>
      </div>

      {/* Loyalty progress — shown when the program is active & client has visits */}
      {loyaltyStatus?.isActive && <ClientLoyaltyCard status={loyaltyStatus} />}

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
                className="rounded-full border px-3 py-1 text-xs"
                style={{ background: "rgba(247,238,243,0.5)", borderColor: "rgba(172,92,127,0.16)", color: "var(--foreground-soft)" }}
              >
                {insight}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Contact details */}
      <Card className="space-y-0 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-muted text-xs font-semibold uppercase tracking-wider">
            {CLIENTS.detail.contactSection}
          </p>
          <ClientEditModal
            clientId={client.id}
            initialData={{
              fullName: client.fullName,
              phone: client.phone,
              email: client.email,
              notes: client.notes,
              isUnsubscribed: client.unsubscribedAt !== null,
            }}
          />
        </div>
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
                <span className="text-muted shrink-0 text-sm">{CLIENTS.detail.email}</span>
                <span className="text-foreground min-w-0 truncate text-sm font-medium" dir="ltr">
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
    </PremiumPageShell>
  );
}
