import Link from "next/link";
import { Users2, CalendarCheck, UserX, Clock, Upload } from "lucide-react";
import { requireCurrentBusiness } from "@/server/auth/session";
import { getClients, getClientSummary } from "@/server/clients/queries";
import { ClientRow } from "@/components/clients/client-row";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { CLIENTS } from "@/lib/constants/he";

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

  const [clients, summary] = await Promise.all([
    getClients(tenant, { search }),
    getClientSummary(tenant),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Page header */}
      <PageHeader
        icon={Users2}
        title="לקוחות"
        subtitle="כל הלקוחות שלך, במקום אחד. ניהול קשרים, מעקב פגישות — בקלות."
        action={
          <Link href="/clients/import">
            <Button
              variant="secondary"
              size="sm"
              className="flex shrink-0 items-center gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              ייבוא לקוחות
            </Button>
          </Link>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="פגישות קרובות"
          helper={CLIENTS.summary.withUpcomingHelper}
          count={summary.withUpcoming}
          icon={<CalendarCheck className="h-4 w-4" />}
          highlight={summary.withUpcoming > 0}
        />
        <MetricCard
          label="לא הגיעו"
          helper={CLIENTS.summary.withNoShowHelper}
          count={summary.withNoShow}
          icon={<UserX className="h-4 w-4" />}
          warn={summary.withNoShow > 0}
        />
        <MetricCard
          label="זקוקים למעקב"
          helper={CLIENTS.summary.notReturnedHelper}
          count={summary.notReturned}
          icon={<Clock className="h-4 w-4" />}
          warn={summary.notReturned > 0}
        />
        <MetricCard
          label={CLIENTS.summary.total}
          helper={CLIENTS.summary.totalHelper}
          count={summary.total}
          icon={<Users2 className="h-4 w-4" />}
        />
      </div>

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
        <EmptyState
          title={CLIENTS.emptyState.title}
          body={CLIENTS.emptyState.body}
          cta={CLIENTS.emptyState.cta}
          ctaHref="/bookings/new"
          icon={<Users2 className="h-7 w-7" style={{ color: "#b86b8c" }} />}
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

      {/* Clients table */}
      {clients.length > 0 && (
        <div
          className="overflow-hidden rounded-2xl"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
          }}
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
                  <ClientRow key={client.id} client={client} businessName={business.name} isTestMode={isTestMode} />
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
    </div>
  );
}
