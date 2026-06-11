import Link from "next/link";
import { Users2, CalendarCheck, UserX, Clock, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { requireCurrentBusiness } from "@/server/auth/session";
import { getClients, getClientSummary } from "@/server/clients/queries";
import { ClientRow } from "@/components/clients/client-row";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
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
  return (
    <div
      className="rounded-2xl px-5 py-4 transition-shadow hover:shadow-md"
      style={{
        background: highlight
          ? "rgba(247,238,243,0.85)"
          : warn
          ? "rgba(254,246,228,0.80)"
          : "rgba(255,255,255,0.90)",
        border: `1px solid ${highlight ? "rgba(184,107,140,0.22)" : warn ? "rgba(184,150,10,0.22)" : "var(--border)"}`,
        boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
      }}
    >
      <div
        className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
        style={{
          background: highlight
            ? "rgba(184,107,140,0.13)"
            : warn
            ? "rgba(184,150,10,0.12)"
            : "rgba(184,107,140,0.08)",
        }}
      >
        <span style={{ color: highlight ? "#b86b8c" : warn ? "#b87c1e" : "#b86b8c" }}>{icon}</span>
      </div>
      <p
        className="text-2xl font-bold tabular-nums"
        style={{ color: highlight ? "#b86b8c" : warn ? "#7a6400" : "#2b2530" }}
      >
        {count}
      </p>
      <p className="mt-1 text-xs font-medium leading-tight" style={{ color: "#8a8190" }}>
        {label}
      </p>
      <p className="mt-0.5 text-[10px] leading-tight" style={{ color: "#bbb3c2" }}>
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            לקוחות
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            כל הלקוחות שלך, במקום אחד. ניהול קשרים, מעקב פגישות — בקלות.
          </p>
        </div>
        <Link href="/clients/import">
          <Button
            variant="secondary"
            size="sm"
            className="flex items-center gap-1.5 shrink-0"
          >
            <Upload className="h-3.5 w-3.5" />
            ייבוא לקוחות
          </Button>
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="פגישות קרובות"
          helper={CLIENTS.summary.withUpcomingHelper}
          count={summary.withUpcoming}
          icon={<CalendarCheck className="h-4 w-4" />}
          highlight={summary.withUpcoming > 0}
        />
        <SummaryCard
          label="לא הגיעו"
          helper={CLIENTS.summary.withNoShowHelper}
          count={summary.withNoShow}
          icon={<UserX className="h-4 w-4" />}
          warn={summary.withNoShow > 0}
        />
        <SummaryCard
          label="זקוקים למעקב"
          helper={CLIENTS.summary.notReturnedHelper}
          count={summary.notReturned}
          icon={<Clock className="h-4 w-4" />}
          warn={summary.notReturned > 0}
        />
        <SummaryCard
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
