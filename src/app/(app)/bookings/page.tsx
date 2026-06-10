import Link from "next/link";
import { CalendarDays, CalendarRange, Clock, XCircle, Plus, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { requireTenant } from "@/server/auth/session";
import { getBookings, getBookingSummary, getActiveCancellationPolicy } from "@/server/bookings/queries";
import { prisma } from "@/server/db/prisma";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingRow } from "@/components/bookings/booking-row";
import { BookingSearchInput } from "@/components/bookings/booking-search-input";
import { BookingAdvancedFilter } from "@/components/bookings/booking-advanced-filter";
import { BOOKINGS } from "@/lib/constants/he";
import type {
  BookingFilter,
  BookingStatusFilter,
  BookingSortField,
  BookingSortDir,
} from "@/server/bookings/queries";

// ---------------------------------------------------------------------------
// Filter label maps
// ---------------------------------------------------------------------------

const FILTER_LABELS: Record<BookingFilter, string> = {
  today: BOOKINGS.filters.today,
  week: BOOKINGS.filters.week,
  all: BOOKINGS.filters.all,
};


// ---------------------------------------------------------------------------
// Table column definitions — order matches BookingRow td order
// ---------------------------------------------------------------------------

type ColDef =
  | { sortable: true; field: BookingSortField; label: string }
  | { sortable: false; label: string };

const TABLE_COLS: ColDef[] = [
  { sortable: true,  field: "clientName", label: "לקוח/ה" },
  { sortable: false, label: "שירות" },
  { sortable: true,  field: "startTime",  label: "תאריך ושעה" },
  { sortable: true,  field: "duration",   label: "משך זמן" },
  { sortable: true,  field: "price",      label: "מחיר" },
  { sortable: true,  field: "status",     label: "סטטוס" },
  { sortable: false, label: "מקדמה" },
  { sortable: false, label: "פעולות" },
];

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  label: string;
  count: number;
  icon: ReactNode;
  highlight?: boolean;
  warn?: boolean;
}

function SummaryCard({ label, count, icon, highlight, warn }: SummaryCardProps) {
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
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{
            background: highlight
              ? "rgba(184,107,140,0.13)"
              : warn
              ? "rgba(184,150,10,0.12)"
              : "rgba(184,107,140,0.08)",
          }}
        >
          <span style={{ color: highlight ? "#b86b8c" : warn ? "#b87c1e" : "#b86b8c" }}>
            {icon}
          </span>
        </div>
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sort icon helper
// ---------------------------------------------------------------------------

function SortIcon({ field, sortField, sortDir, hasExplicitSort }: { field: BookingSortField; sortField: BookingSortField; sortDir: BookingSortDir; hasExplicitSort: boolean }) {
  if (!hasExplicitSort || sortField !== field) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
  return sortDir === "asc"
    ? <ChevronUp className="h-3 w-3" style={{ color: "#b86b8c" }} />
    : <ChevronDown className="h-3 w-3" style={{ color: "#b86b8c" }} />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    status?: string;
    created?: string;
    q?: string;
    serviceId?: string;
    deposit?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const tenant = await requireTenant();
  const {
    filter: rawFilter,
    status: rawStatus,
    created,
    q: rawSearch,
    serviceId: rawServiceId,
    deposit: rawDeposit,
    sort: rawSort,
    dir: rawDir,
  } = await searchParams;

  // Validate and coerce params
  const filter: BookingFilter =
    rawFilter === "today" || rawFilter === "week" || rawFilter === "all"
      ? rawFilter
      : "all";

  const statusFilter: BookingStatusFilter =
    rawStatus === "pending" || rawStatus === "active" || rawStatus === "completed" || rawStatus === "cancelled"
      ? rawStatus
      : "all";

  const search = rawSearch?.trim() || undefined;
  const serviceId = rawServiceId || undefined;
  const depositStatusFilter = rawDeposit || undefined;

  const validSortFields: BookingSortField[] = ["startTime", "price", "duration", "status", "createdAt", "clientName"];
  const sortField: BookingSortField =
    rawSort && validSortFields.includes(rawSort as BookingSortField)
      ? (rawSort as BookingSortField)
      : "startTime";

  const sortDir: BookingSortDir = rawDir === "asc" || rawDir === "desc" ? rawDir : "desc";

  // When the user hasn't explicitly clicked a sort column, use priority-based smart sort
  const hasExplicitSort = !!rawSort;

  // Fetch data
  const [bookings, summary, services, cancellationPolicy] = await Promise.all([
    getBookings(tenant, { filter, statusFilter, search, serviceId, depositStatusFilter, sortField, sortDir, smartSort: !hasExplicitSort }),
    getBookingSummary(tenant),
    prisma.service.findMany({
      where: { businessId: tenant.businessId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getActiveCancellationPolicy(tenant),
  ]);

  // ---------------------------------------------------------------------------
  // URL builder helpers — preserve all active params
  // ---------------------------------------------------------------------------

  function buildParams(overrides: Record<string, string | undefined>) {
    const base: Record<string, string> = {};
    if (filter !== "all") base.filter = filter;
    if (statusFilter !== "all") base.status = statusFilter;
    if (search) base.q = search;
    if (serviceId) base.serviceId = serviceId;
    if (depositStatusFilter) base.deposit = depositStatusFilter;
    if (sortField !== "startTime") base.sort = sortField;
    if (rawDir) base.dir = sortDir;
    const merged = { ...base, ...overrides };
    const params = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    return params.toString();
  }

  const filterHref = (f: BookingFilter) => `/bookings?${buildParams({ filter: f !== "all" ? f : undefined })}`;

  // Sort href — toggle direction if already sorted by this field
  const sortHref = (field: BookingSortField) => {
    const nextDir: BookingSortDir =
      sortField === field ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    return `/bookings?${buildParams({ sort: field, dir: nextDir })}`;
  };

  // Params string for search input client component (all except "q")
  const searchOtherParams = buildParams({ q: undefined });

  // Params for advanced filter component — everything except status/serviceId/deposit
  const advancedFilterBaseParams = buildParams({ status: undefined, serviceId: undefined, deposit: undefined });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            ניהול לקוחות ותורים
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            כאן תוכלו לנהל את כל התורים והפגישות שלכם בקלות.
          </p>
        </div>
        <Link
          href="/bookings/new"
          className="flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
            color: "#fff",
            boxShadow: "0 2px 8px rgba(184,107,140,0.30)",
          }}
        >
          <Plus className="h-4 w-4" />
          קביעת פגישה חדשה
        </Link>
      </div>

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
          label="היום"
          count={summary.todayCount}
          icon={<CalendarDays className="h-4 w-4" />}
          highlight={summary.todayCount > 0}
        />
        <SummaryCard
          label={BOOKINGS.summary.pending}
          count={summary.pendingCount}
          icon={<Clock className="h-4 w-4" />}
          warn={summary.pendingCount > 0}
        />
        <SummaryCard
          label={BOOKINGS.summary.cancelled}
          count={summary.cancelledCount}
          icon={<XCircle className="h-4 w-4" />}
          warn={summary.cancelledCount > 0}
        />
        <SummaryCard
          label={BOOKINGS.summary.week}
          count={summary.weekCount}
          icon={<CalendarRange className="h-4 w-4" />}
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
              ? "תור אחד ללא מקדמה — שלחי בקשה ללקוחה"
              : `${summary.pendingDepositCount} תורים ללא מקדמה — כדאי לשלוח בקשה`}
          </p>
        </div>
      )}

      {/* ── Filter toolbar ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-3">
        {/* Debounced search — client component */}
        <BookingSearchInput initialValue={search ?? ""} otherParams={searchOtherParams} />

        {/* Date range tabs */}
        <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(43,37,48,0.05)" }}>
          {(["all", "today", "week"] as BookingFilter[]).map((f) => (
            <Link
              key={f}
              href={filterHref(f)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
                filter === f ? "bg-surface text-foreground" : "text-muted hover:text-foreground"
              }`}
              style={filter === f ? { boxShadow: "var(--shadow-xs)" } : undefined}
            >
              {FILTER_LABELS[f]}
            </Link>
          ))}
        </div>

        {/* Advanced filter — button + popover + active chips */}
        <BookingAdvancedFilter
          services={services}
          currentStatus={statusFilter}
          currentServiceId={serviceId}
          currentDeposit={depositStatusFilter}
          baseParams={advancedFilterBaseParams}
        />
      </div>

      {/* Empty state — contextual based on active filter */}
      {bookings.length === 0 && (() => {
        let title: string = BOOKINGS.emptyState.title;
        let body: string = BOOKINGS.emptyState.body;
        if (statusFilter === "pending") {
          title = "אין כרגע פגישות שממתינות לאישור";
          body = "כל הפגישות אושרו. כשתגיע בקשה חדשה, היא תופיע כאן.";
        } else if (statusFilter === "active") {
          title = "אין פגישות פעילות כרגע";
          body = "לא נמצאו פגישות פעילות התואמות לחיפוש.";
        } else if (statusFilter === "completed") {
          title = "אין פגישות שהושלמו";
          body = "פגישות שסומנו כהושלמו יופיעו כאן.";
        } else if (statusFilter === "cancelled") {
          title = "אין פגישות שבוטלו";
          body = "פגישות שבוטלו יופיעו כאן.";
        } else if (depositStatusFilter === "pending") {
          title = "אין כרגע מקדמות שדורשות טיפול";
          body = "כל המקדמות מסודרות. כשתור ידרוש מקדמה, הוא יופיע כאן.";
        } else if (depositStatusFilter === "paid") {
          title = "לא נמצאו תורים עם מקדמה ששולמה";
          body = "תורים שבהם המקדמה אושרה יופיעו כאן.";
        }
        return (
          <EmptyState
            title={title}
            body={body}
            cta={BOOKINGS.emptyState.cta}
            ctaHref="/bookings/new"
            icon={<CalendarDays className="h-7 w-7" style={{ color: "#b86b8c" }} />}
          />
        );
      })()}

      {/* Bookings table */}
      {bookings.length > 0 && (
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
                    background:
                      "linear-gradient(135deg, rgba(247,238,243,0.60) 0%, rgba(255,255,255,0) 100%)",
                  }}
                >
                  {TABLE_COLS.map((col) =>
                    col.sortable ? (
                      <th
                        key={col.field}
                        className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide"
                        style={{ color: (hasExplicitSort && sortField === col.field) ? "#b86b8c" : "var(--muted)" }}
                      >
                        <Link
                          href={sortHref(col.field)}
                          className="inline-flex items-center gap-1 hover:opacity-80"
                        >
                          {col.label}
                          <SortIcon field={col.field} sortField={sortField} sortDir={sortDir} hasExplicitSort={hasExplicitSort} />
                        </Link>
                      </th>
                    ) : (
                      <th
                        key={col.label}
                        className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide"
                        style={{ color: "var(--muted)" }}
                      >
                        {col.label}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <BookingRow
                    key={booking.id}
                    booking={booking}
                    lateCancellationHours={cancellationPolicy?.lateCancellationHours ?? null}
                  />
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
            <span>מציג {bookings.length} פגישות</span>
            <Link
              href="/bookings"
              className="font-medium hover:underline"
              style={{ color: "#b86b8c" }}
            >
              צפייה בכל הפגישות ←
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
