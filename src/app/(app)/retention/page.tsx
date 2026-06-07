import Link from "next/link";
import { HeartHandshake, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
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

export default async function RetentionPage() {
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };

  const [clients, summary] = await Promise.all([
    getRetentionClients(tenant),
    getRetentionSummary(tenant),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6" dir="rtl">
      {/* Page header */}
      <PageHeader
        icon={HeartHandshake}
        title={RETENTION.pageTitle}
        subtitle="לקוחות שלא חזרו לאחרונה והודעות מוכנות לחידוש קשר."
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-foreground text-2xl font-bold tabular-nums">
            {summary.notReturnedCount}
          </p>
          <p className="text-muted mt-1 text-xs leading-tight">
            {RETENTION.summary.notReturned}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-foreground text-2xl font-bold tabular-nums">
            {summary.withUpcomingCount}
          </p>
          <p className="text-muted mt-1 text-xs leading-tight">
            {RETENTION.summary.withUpcoming}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-foreground text-2xl font-bold tabular-nums">
            {clients.length}
          </p>
          <p className="text-muted mt-1 text-xs leading-tight">
            {RETENTION.summary.messagesToSend}
          </p>
        </Card>
      </div>

      {/* Client list or empty state */}
      {clients.length === 0 ? (
        <Card className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, rgba(201,120,152,0.12) 0%, rgba(184,107,140,0.08) 100%)",
              }}
            >
              <Users className="h-6 w-6" style={{ color: "#b86b8c" }} />
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
