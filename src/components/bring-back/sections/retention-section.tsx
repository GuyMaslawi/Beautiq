import Link from "next/link";
import { HeartHandshake, Users, Clock, CalendarCheck, MessageCircle } from "lucide-react";
import { EditorialSectionHeader } from "@/components/premium";
import { requireCurrentBusiness } from "@/server/auth/session";
import { getRetentionClients, getRetentionSummary } from "@/server/retention/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RetentionClientCard } from "@/components/retention/retention-client-card";
import { RETENTION } from "@/lib/constants/he";

function formatLastVisit(date: Date): string {
  return new Date(date).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** מעקב שימור — לקוחות שלא חזרו לאחרונה, עם דגלי ביטול/אי-הגעה ותור קרוב. */
export async function RetentionSection() {
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };

  const [clients, summary] = await Promise.all([
    getRetentionClients(tenant),
    getRetentionSummary(tenant),
  ]);

  return (
    <div className="w-full space-y-6" dir="rtl">
      {/* Section header */}
      <EditorialSectionHeader
        icon={<HeartHandshake className="h-4 w-4" />}
        eyebrow="שימור לקוחות"
        title={RETENTION.pageTitle}
        description="לקוחות שלא חזרו לאחרונה והודעות מוכנות לחידוש קשר."
        tint="plum"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* לא חזרו */}
        <div
          className="rounded-2xl px-3.5 py-3.5 transition-shadow hover:shadow-md sm:px-5 sm:py-4"
          style={{
            background: summary.notReturnedCount > 0 ? "rgba(254,246,228,0.80)" : "rgba(255,255,255,0.90)",
            border: `1px solid ${summary.notReturnedCount > 0 ? "rgba(184,150,10,0.22)" : "var(--border)"}`,
            boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
          }}
        >
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: summary.notReturnedCount > 0 ? "rgba(184,150,10,0.12)" : "rgba(172,92,127,0.08)" }}
          >
            <Clock className="h-4 w-4" style={{ color: summary.notReturnedCount > 0 ? "#b87c1e" : "#ac5c7f" }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: summary.notReturnedCount > 0 ? "#7a6400" : "#2b2530" }}>
            {summary.notReturnedCount}
          </p>
          <p className="mt-1 text-xs font-medium leading-tight" style={{ color: "#8a8190" }}>
            {RETENTION.summary.notReturned}
          </p>
        </div>

        {/* עם תור קרוב */}
        <div
          className="rounded-2xl px-3.5 py-3.5 transition-shadow hover:shadow-md sm:px-5 sm:py-4"
          style={{
            background: summary.withUpcomingCount > 0 ? "rgba(247,238,243,0.85)" : "rgba(255,255,255,0.90)",
            border: `1px solid ${summary.withUpcomingCount > 0 ? "rgba(172,92,127,0.22)" : "var(--border)"}`,
            boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
          }}
        >
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: summary.withUpcomingCount > 0 ? "rgba(172,92,127,0.13)" : "rgba(172,92,127,0.08)" }}
          >
            <CalendarCheck className="h-4 w-4" style={{ color: "#ac5c7f" }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: summary.withUpcomingCount > 0 ? "#ac5c7f" : "#2b2530" }}>
            {summary.withUpcomingCount}
          </p>
          <p className="mt-1 text-xs font-medium leading-tight" style={{ color: "#8a8190" }}>
            {RETENTION.summary.withUpcoming}
          </p>
        </div>

        {/* הודעות לשליחה */}
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
            {clients.length}
          </p>
          <p className="mt-1 text-xs font-medium leading-tight" style={{ color: "#8a8190" }}>
            {RETENTION.summary.messagesToSend}
          </p>
        </div>
      </div>

      {/* Client list or empty state */}
      {clients.length === 0 ? (
        <Card className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, rgba(199,111,147,0.12) 0%, rgba(172,92,127,0.08) 100%)",
              }}
            >
              <Users className="h-6 w-6" style={{ color: "#ac5c7f" }} />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">
              {RETENTION.emptyState.title}
            </h2>
            <p className="text-muted text-sm leading-relaxed max-w-sm mx-auto">
              {RETENTION.emptyState.body}
            </p>
          </div>
          <Link href={RETENTION.emptyState.ctaHref}>
            <Button variant="secondary" size="sm">
              {RETENTION.emptyState.cta}
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <RetentionClientCard
              key={client.id}
              client={client}
              businessName={business.name}
              lastVisitFormatted={formatLastVisit(client.lastCompletedBookingAt)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
