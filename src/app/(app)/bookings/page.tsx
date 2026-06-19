import Link from "next/link";
import { CalendarDays, CalendarRange, Clock, XCircle, Plus, ChevronUp, ChevronDown, ChevronsUpDown, List } from "lucide-react";
import { requireTenant } from "@/server/auth/session";
import { getBookings, getBookingSummary, getActiveCancellationPolicy, getCalendarBookings } from "@/server/bookings/queries";
import { prisma } from "@/server/db/prisma";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { BookingRow } from "@/components/bookings/booking-row";
import { BookingSearchInput } from "@/components/bookings/booking-search-input";
import { BookingAdvancedFilter } from "@/components/bookings/booking-advanced-filter";
import { BookingsCalendar } from "@/components/bookings/bookings-calendar";
import { BOOKINGS } from "@/lib/constants/he";
import type {
  BookingFilter,
  BookingStatusFilter,
  BookingSortField,
  BookingSortDir,
} from "@/server/bookings/queries";

// ---------------------------------------------------------------------------
// Israel timezone helpers for the calendar
// ---------------------------------------------------------------------------

const IL_TZ = "Asia/Jerusalem";

function getIsraelToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IL_TZ }).format(new Date());
}

function israelDateToRange(dateStr: string): { start: Date; end: Date } {
  // Use noon UTC as reference — guaranteed to land on the correct Israel calendar day
  const ref = new Date(`${dateStr}T12:00:00Z`);
  // Find midnight Israel time for this date
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: IL_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(ref);
  const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  const s = parseInt(parts.find((p) => p.type === "second")!.value, 10);
  const start = new Date(ref.getTime() - (h * 3600 + m * 60 + s) * 1000 - ref.getMilliseconds());
  const end = new Date(start.getTime() + 86400000 - 1);
  return { start, end };
}

function israelWeekStart(dateStr: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  const dow = date.getDay(); // 0=Sunday
  date.setDate(date.getDate() - dow);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

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
  { sortable: false, label: "פעולות" },
];

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
    view?: string;
    calDate?: string;
    calView?: string;
    filter?: string;
    status?: string;
    created?: string;
    q?: string;
    serviceId?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const tenant = await requireTenant();
  const {
    view: rawView,
    calDate: rawCalDate,
    calView: rawCalView,
    filter: rawFilter,
    status: rawStatus,
    created,
    q: rawSearch,
    serviceId: rawServiceId,
    sort: rawSort,
    dir: rawDir,
  } = await searchParams;

  const isCalendarView = rawView === "calendar";
  const calView: "day" | "week" = rawCalView === "week" ? "week" : "day";
  const todayStr = getIsraelToday();
  const calDate = rawCalDate && /^\d{4}-\d{2}-\d{2}$/.test(rawCalDate) ? rawCalDate : todayStr;

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

  const validSortFields: BookingSortField[] = ["startTime", "price", "duration", "status", "createdAt", "clientName"];
  const sortField: BookingSortField =
    rawSort && validSortFields.includes(rawSort as BookingSortField)
      ? (rawSort as BookingSortField)
      : "startTime";

  const sortDir: BookingSortDir = rawDir === "asc" || rawDir === "desc" ? rawDir : "desc";

  // When the user hasn't explicitly clicked a sort column, use priority-based smart sort
  const hasExplicitSort = !!rawSort;

  // Fetch data
  const [bookings, summary, services, cancellationPolicy, calBookings] = await Promise.all([
    isCalendarView
      ? Promise.resolve([])
      : getBookings(tenant, { filter, statusFilter, search, serviceId, sortField, sortDir, smartSort: !hasExplicitSort }),
    getBookingSummary(tenant),
    isCalendarView
      ? Promise.resolve([])
      : prisma.service.findMany({
          where: { businessId: tenant.businessId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
    isCalendarView ? Promise.resolve(null) : getActiveCancellationPolicy(tenant),
    isCalendarView
      ? (() => {
          if (calView === "day") {
            const { start, end } = israelDateToRange(calDate);
            return getCalendarBookings(tenant, start, end);
          } else {
            const ws = israelWeekStart(calDate);
            const { start } = israelDateToRange(ws);
            const end = new Date(start.getTime() + 7 * 86400000 - 1);
            return getCalendarBookings(tenant, start, end);
          }
        })()
      : Promise.resolve([]),
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

  // Params for advanced filter component — everything except status/serviceId
  const advancedFilterBaseParams = buildParams({ status: undefined, serviceId: undefined });

  return (
    <div className={isCalendarView ? "w-full space-y-3" : "mx-auto w-full max-w-6xl space-y-6"}>
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            תורים
          </h1>
          {!isCalendarView && (
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              נהלי תורים, צפי לפגישות ויומן עסקי.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="hidden sm:flex rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <Link
              href="/bookings"
              className="flex h-9 items-center gap-1.5 px-3 text-xs font-medium transition-colors"
              style={{
                background: !isCalendarView ? "rgba(184,107,140,0.10)" : "transparent",
                color: !isCalendarView ? "#b86b8c" : "var(--foreground-soft)",
              }}
            >
              <List className="h-3.5 w-3.5" />
              רשימה
            </Link>
            <Link
              href={`/bookings?view=calendar&calDate=${todayStr}&calView=day`}
              className="flex h-9 items-center gap-1.5 border-r px-3 text-xs font-medium transition-colors"
              style={{
                borderColor: "var(--border)",
                background: isCalendarView ? "rgba(184,107,140,0.10)" : "transparent",
                color: isCalendarView ? "#b86b8c" : "var(--foreground-soft)",
              }}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              יומן
            </Link>
          </div>
          {!isCalendarView && (
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
              תור חדש
            </Link>
          )}
        </div>
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

      {/* Summary cards — compact chips in calendar mode, full cards in list mode */}
      {isCalendarView ? (
        <div className="flex items-center gap-2 flex-wrap" dir="rtl">
          <MetricCard
            label="תורים היום"
            count={summary.todayCount}
            icon={<CalendarDays className="h-3.5 w-3.5" />}
            highlight={summary.todayCount > 0}
            compact
          />
          <MetricCard
            label={BOOKINGS.summary.pending}
            count={summary.pendingCount}
            icon={<Clock className="h-3.5 w-3.5" />}
            warn={summary.pendingCount > 0}
            compact
          />
          <MetricCard
            label="ביטולים"
            count={summary.cancelledCount}
            icon={<XCircle className="h-3.5 w-3.5" />}
            warn={summary.cancelledCount > 0}
            compact
          />
          <MetricCard
            label={BOOKINGS.summary.week}
            count={summary.weekCount}
            icon={<CalendarRange className="h-3.5 w-3.5" />}
            compact
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              label="היום"
              count={summary.todayCount}
              icon={<CalendarDays className="h-4 w-4" />}
              highlight={summary.todayCount > 0}
            />
            <MetricCard
              label={BOOKINGS.summary.pending}
              count={summary.pendingCount}
              icon={<Clock className="h-4 w-4" />}
              warn={summary.pendingCount > 0}
            />
            <MetricCard
              label={BOOKINGS.summary.cancelled}
              count={summary.cancelledCount}
              icon={<XCircle className="h-4 w-4" />}
              warn={summary.cancelledCount > 0}
            />
            <MetricCard
              label={BOOKINGS.summary.week}
              count={summary.weekCount}
              icon={<CalendarRange className="h-4 w-4" />}
            />
          </div>
        </>
      )}

      {/* ── Calendar view ───────────────────────────────────────────────── */}
      {isCalendarView && (
        <BookingsCalendar
          bookings={calBookings}
          calDate={calDate}
          calView={calView}
        />
      )}

      {/* ── Table view (filters + empty state + table) ──────────────────── */}
      {!isCalendarView && (
        <>
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
                <span>מציג {bookings.length} תורים</span>
                <Link
                  href="/bookings"
                  className="font-medium hover:underline"
                  style={{ color: "#b86b8c" }}
                >
                  צפייה בכל התורים ←
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
