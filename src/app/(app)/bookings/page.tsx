import Link from "next/link";
import { CalendarDays, CalendarRange, Clock, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { requireTenant } from "@/server/auth/session";
import { getBookings, getBookingSummary } from "@/server/bookings/queries";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingCard } from "@/components/bookings/booking-card";
import { PageHeader } from "@/components/ui/page-header";
import { BOOKINGS } from "@/lib/constants/he";
import type { BookingFilter, BookingStatusFilter } from "@/server/bookings/queries";

const FILTER_LABELS: Record<BookingFilter, string> = {
  today: BOOKINGS.filters.today,
  week: BOOKINGS.filters.week,
  all: BOOKINGS.filters.all,
};

const STATUS_FILTER_LABELS: Record<BookingStatusFilter, string> = {
  all: BOOKINGS.statusFilters.all,
  active: BOOKINGS.statusFilters.active,
  completed: BOOKINGS.statusFilters.completed,
  cancelled: BOOKINGS.statusFilters.cancelled,
};

interface SummaryCardProps {
  label: string;
  count: number;
  icon: ReactNode;
  highlight?: boolean;
  warn?: boolean;
}

function SummaryCard({ label, count, icon, highlight, warn }: SummaryCardProps) {
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
    </div>
  );
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; status?: string; created?: string }>;
}) {
  const tenant = await requireTenant();
  const { filter: rawFilter, status: rawStatus, created } = await searchParams;

  const filter: BookingFilter =
    rawFilter === "today" || rawFilter === "week" || rawFilter === "all"
      ? rawFilter
      : "all";

  const statusFilter: BookingStatusFilter =
    rawStatus === "active" ||
    rawStatus === "completed" ||
    rawStatus === "cancelled"
      ? rawStatus
      : "all";

  const [bookings, summary] = await Promise.all([
    getBookings(tenant, filter, statusFilter),
    getBookingSummary(tenant),
  ]);

  // Build href helper that preserves the other param
  const filterHref = (f: BookingFilter) => {
    const params = new URLSearchParams();
    params.set("filter", f);
    if (statusFilter !== "all") params.set("status", statusFilter);
    return `/bookings?${params.toString()}`;
  };

  const statusHref = (s: BookingStatusFilter) => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    if (s !== "all") params.set("status", s);
    const qs = params.toString();
    return qs ? `/bookings?${qs}` : "/bookings";
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Page header */}
      <PageHeader
        icon={CalendarDays}
        title={BOOKINGS.pageTitle}
        subtitle={BOOKINGS.pageSubtitle}
        action={
          <Link href="/bookings/new">
            <Button size="sm">{BOOKINGS.addButton}</Button>
          </Link>
        }
      />

      {/* Success banner */}
      {created === "true" && (
        <div
          className="flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{ borderColor: "rgba(61,139,110,0.25)", background: "rgba(61,139,110,0.07)" }}
        >
          <span className="text-sm font-bold" style={{ color: "#3d8b6e" }}>✓</span>
          <p className="text-sm font-medium" style={{ color: "#2a6e57" }}>
            {BOOKINGS.createdSuccess}
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label={BOOKINGS.summary.today}
          count={summary.todayCount}
          icon={<CalendarDays className="h-3.5 w-3.5" />}
        />
        <SummaryCard
          label={BOOKINGS.summary.week}
          count={summary.weekCount}
          icon={<CalendarRange className="h-3.5 w-3.5" />}
        />
        <SummaryCard
          label={BOOKINGS.summary.pending}
          count={summary.pendingCount}
          icon={<Clock className="h-3.5 w-3.5" />}
          highlight={summary.pendingCount > 0}
        />
        <SummaryCard
          label={BOOKINGS.summary.cancelled}
          count={summary.cancelledCount}
          icon={<XCircle className="h-3.5 w-3.5" />}
          warn={summary.cancelledCount > 0}
        />
      </div>

      {/* Pending deposit alert */}
      {summary.pendingDepositCount > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{ borderColor: "rgba(184,150,10,0.25)", background: "rgba(184,150,10,0.06)" }}
        >
          <span className="text-sm" style={{ color: "#b87c1e" }}>💳</span>
          <p className="text-sm font-medium" style={{ color: "#7a6400" }}>
            {summary.pendingDepositCount === 1
              ? "תור אחד ממתין לאישור מקדמה"
              : `${summary.pendingDepositCount} תורים ממתינים לאישור מקדמה`}
          </p>
        </div>
      )}

      {/* Date filter tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(43,37,48,0.05)" }}>
        {(["all", "today", "week"] as BookingFilter[]).map((f) => (
          <Link
            key={f}
            href={filterHref(f)}
            className={`flex-1 rounded-lg py-2 text-center text-sm font-medium transition-all ${
              filter === f
                ? "bg-surface text-foreground"
                : "text-muted hover:text-foreground"
            }`}
            style={filter === f ? { boxShadow: "var(--shadow-xs)" } : undefined}
          >
            {FILTER_LABELS[f]}
          </Link>
        ))}
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {(["all", "active", "completed", "cancelled"] as BookingStatusFilter[]).map(
          (s) => (
            <Link
              key={s}
              href={statusHref(s)}
              className="rounded-full border px-3 py-1 text-xs font-medium transition-all"
              style={
                statusFilter === s
                  ? {
                      background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
                      borderColor: "transparent",
                      color: "#fff",
                    }
                  : { borderColor: "var(--border)", color: "var(--muted)" }
              }
            >
              {STATUS_FILTER_LABELS[s]}
            </Link>
          ),
        )}
      </div>

      {/* Empty state */}
      {bookings.length === 0 && (
        <EmptyState
          title={BOOKINGS.emptyState.title}
          body={BOOKINGS.emptyState.body}
          cta={BOOKINGS.emptyState.cta}
          ctaHref="/bookings/new"
          icon={<CalendarDays className="h-7 w-7" style={{ color: "#b86b8c" }} />}
        />
      )}

      {/* Booking list */}
      {bookings.length > 0 && (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </div>
  );
}
