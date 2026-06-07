import Link from "next/link";
import { Users2, CalendarCheck, UserX, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { requireTenant } from "@/server/auth/session";
import { getClients, getClientSummary } from "@/server/clients/queries";
import { ClientCard } from "@/components/clients/client-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { CLIENTS } from "@/lib/constants/he";

interface SummaryCardProps {
  label: string;
  helper: string;
  count: number;
  icon: ReactNode;
  highlight?: boolean;
  warn?: boolean;
}

function SummaryCard({ label, helper, count, icon, highlight, warn }: SummaryCardProps) {
  const bg = highlight
    ? "rgba(247,238,243,0.85)"
    : warn
    ? "rgba(254,246,228,0.80)"
    : "rgba(247,238,243,0.38)";
  const borderColor = highlight
    ? "rgba(184,107,140,0.22)"
    : warn
    ? "rgba(184,150,10,0.22)"
    : "var(--border)";
  const numColor = highlight ? "#b86b8c" : warn ? "#7a6400" : "#2b2530";
  const iconBg = highlight
    ? "rgba(184,107,140,0.13)"
    : warn
    ? "rgba(184,150,10,0.12)"
    : "rgba(184,107,140,0.08)";
  const iconColor = highlight ? "#b86b8c" : warn ? "#b87c1e" : "#b86b8c";

  return (
    <div
      className="rounded-xl px-4 py-3.5"
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        boxShadow: "0 1px 3px rgba(43,37,48,0.05)",
      }}
    >
      <div
        className="mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg"
        style={{ background: iconBg }}
      >
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <p className="text-xs font-medium leading-tight" style={{ color: "#8a8190" }}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: numColor }}>
        {count}
      </p>
      <p className="mt-1 text-xs leading-tight" style={{ color: "#bbb3c2" }}>
        {helper}
      </p>
    </div>
  );
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const tenant = await requireTenant();
  const { q } = await searchParams;
  const search = q?.trim() || undefined;

  const [clients, summary] = await Promise.all([
    getClients(tenant, { search }),
    getClientSummary(tenant),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Page header */}
      <PageHeader
        icon={Users2}
        title={CLIENTS.pageTitle}
        subtitle="כאן מנהלים את הלקוחות, ההיסטוריה והקשר איתם."
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label={CLIENTS.summary.total}
          helper={CLIENTS.summary.totalHelper}
          count={summary.total}
          icon={<Users2 className="h-3.5 w-3.5" />}
        />
        <SummaryCard
          label={CLIENTS.summary.withUpcoming}
          helper={CLIENTS.summary.withUpcomingHelper}
          count={summary.withUpcoming}
          icon={<CalendarCheck className="h-3.5 w-3.5" />}
          highlight={summary.withUpcoming > 0}
        />
        <SummaryCard
          label={CLIENTS.summary.withNoShow}
          helper={CLIENTS.summary.withNoShowHelper}
          count={summary.withNoShow}
          icon={<UserX className="h-3.5 w-3.5" />}
          warn={summary.withNoShow > 0}
        />
        <SummaryCard
          label={CLIENTS.summary.notReturned}
          helper={CLIENTS.summary.notReturnedHelper}
          count={summary.notReturned}
          icon={<Clock className="h-3.5 w-3.5" />}
          warn={summary.notReturned > 0}
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
            <Button variant="ghost" size="sm">
              ✕
            </Button>
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
        <div className="rounded-2xl border border-border bg-surface px-6 py-12 text-center"
          style={{ boxShadow: "var(--shadow-sm)" }}>
          <h3 className="text-foreground text-base font-semibold">
            {CLIENTS.searchEmpty.title}
          </h3>
          <p className="text-muted mx-auto mt-2 max-w-xs text-sm leading-6">
            {CLIENTS.searchEmpty.body}
          </p>
          <div className="mt-4">
            <Link href="/clients">
              <Button variant="secondary" size="sm">
                {CLIENTS.searchEmpty.showAll}
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Client list */}
      {clients.length > 0 && (
        <div className="space-y-3">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </div>
  );
}
