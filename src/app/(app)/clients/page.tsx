import Link from "next/link";
import { Users2, CalendarCheck, UserX, Clock, Upload } from "lucide-react";
import { requireCurrentBusiness, getCurrentUser } from "@/server/auth/session";
import { getClients, getClientSummary } from "@/server/clients/queries";
import { getClientsLoyaltyBadges } from "@/server/loyalty/queries";
import { getCampaignsForBusiness } from "@/server/whatsapp/campaigns/queries";
import { ClientRow } from "@/components/clients/client-row";
import { ClientCard } from "@/components/clients/client-card";
import { BulkCampaignDrawer } from "@/components/clients/campaigns/bulk-campaign-drawer";
import { CampaignHistory } from "@/components/clients/campaigns/campaign-history";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLIENTS } from "@/lib/constants/he";
import { PremiumPageShell } from "@/components/premium/page-shell";
import { BeautyPageHero } from "@/components/premium/page-hero";
import { PremiumMetricCard } from "@/components/premium/metric-card";
import { PremiumEmptyState } from "@/components/premium/empty-state";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };
  const { q } = await searchParams;
  const search = q?.trim() || undefined;
  const isTestMode = process.env.WHATSAPP_TEST_MODE === "true";
  const ownerPlan = (await getCurrentUser())?.plan ?? null;

  const [clients, summary, campaigns] = await Promise.all([
    getClients(tenant, { search }),
    getClientSummary(tenant),
    getCampaignsForBusiness(tenant),
  ]);

  // Loyalty progress badges for the visible clients (empty when program is off).
  const loyaltyBadges = await getClientsLoyaltyBadges(
    tenant,
    clients.map((c) => c.id),
  );

  return (
    <PremiumPageShell tint="rose" width="wide">
      {/* Page header */}
      <BeautyPageHero
        icon={Users2}
        eyebrow="הקשר עם הלקוחות"
        title="לקוחות"
        subtitle="כל הלקוחות שלך, במקום אחד. ניהול קשרים, מעקב פגישות — בקלות."
        tint="rose"
        action={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {summary.total > 0 && <BulkCampaignDrawer />}
            <Link href="/clients/import">
              <Button variant="secondary" size="sm" className="flex shrink-0 items-center gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                ייבוא לקוחות
              </Button>
            </Link>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PremiumMetricCard
          label="פגישות קרובות"
          helper={CLIENTS.summary.withUpcomingHelper}
          count={summary.withUpcoming}
          icon={<CalendarCheck className="h-4 w-4" />}
          tone={summary.withUpcoming > 0 ? "brand" : "neutral"}
        />
        <PremiumMetricCard
          label="לא הגיעו"
          helper={CLIENTS.summary.withNoShowHelper}
          count={summary.withNoShow}
          icon={<UserX className="h-4 w-4" />}
          tone={summary.withNoShow > 0 ? "warning" : "neutral"}
        />
        <PremiumMetricCard
          label="זקוקים למעקב"
          helper={CLIENTS.summary.notReturnedHelper}
          count={summary.notReturned}
          icon={<Clock className="h-4 w-4" />}
          tone={summary.notReturned > 0 ? "warning" : "neutral"}
        />
        <PremiumMetricCard
          label={CLIENTS.summary.total}
          helper={CLIENTS.summary.totalHelper}
          count={summary.total}
          icon={<Users2 className="h-4 w-4" />}
        />
      </div>

      {/* WhatsApp campaign history */}
      {campaigns.length > 0 && <CampaignHistory campaigns={campaigns} />}

      {/* Search */}
      <form method="GET" action="/clients" className="flex gap-2">
        <Input
          name="q"
          defaultValue={search ?? ""}
          placeholder={CLIENTS.search.placeholder}
          className="h-10 flex-1 text-sm"
          autoComplete="off"
        />
        <Button type="submit" variant="secondary" size="sm">
          {CLIENTS.search.button}
        </Button>
        {search && (
          <Link href="/clients">
            <Button variant="ghost" size="sm">✕</Button>
          </Link>
        )}
      </form>

      {/* Empty state — no clients at all */}
      {summary.total === 0 && (
        <PremiumEmptyState
          tint="rose"
          title={CLIENTS.emptyState.title}
          body={CLIENTS.emptyState.body}
          cta={CLIENTS.emptyState.cta}
          ctaHref="/bookings/new"
          icon={<Users2 className="h-7 w-7" />}
          orbit={[<CalendarCheck key="a" className="h-4 w-4" />, <Clock key="b" className="h-4 w-4" />, <UserX key="c" className="h-4 w-4" />]}
        />
      )}

      {/* Empty state — search returned nothing */}
      {summary.total > 0 && clients.length === 0 && search && (
        <div
          className="rounded-2xl border px-6 py-12 text-center"
          style={{ borderColor: "var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}
        >
          <h3 className="text-foreground text-base font-semibold">{CLIENTS.searchEmpty.title}</h3>
          <p className="text-muted mx-auto mt-2 max-w-xs text-sm leading-6">{CLIENTS.searchEmpty.body}</p>
          <div className="mt-4">
            <Link href="/clients">
              <Button variant="secondary" size="sm">{CLIENTS.searchEmpty.showAll}</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Clients — mobile card list (no horizontal scroll on phones) */}
      {clients.length > 0 && (
        <div className="space-y-3 md:hidden">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              businessName={business.name}
              isTestMode={isTestMode}
              ownerPlan={ownerPlan}
              loyalty={loyaltyBadges.get(client.id) ?? null}
            />
          ))}
        </div>
      )}

      {/* Clients table — desktop only */}
      {clients.length > 0 && (
        <div
          className="aura-card hidden overflow-hidden rounded-[1.4rem] md:block"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: "linear-gradient(135deg, rgba(247,238,243,0.60) 0%, rgba(255,255,255,0) 100%)",
                  }}
                >
                  {["לקוח", "פרטים", "פעילות", "היסטוריה", "ערך לקוח", "פעולות"].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--muted)" }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <ClientRow key={client.id} client={client} businessName={business.name} isTestMode={isTestMode} ownerPlan={ownerPlan} loyalty={loyaltyBadges.get(client.id) ?? null} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between px-4 py-3 text-xs"
            style={{
              borderTop: "1px solid var(--border)",
              background: "rgba(247,238,243,0.25)",
              color: "var(--muted)",
            }}
          >
            <span>מציג {clients.length} מתוך {summary.total} לקוחות</span>
          </div>
        </div>
      )}
    </PremiumPageShell>
  );
}
