import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import { scopedWhere } from "@/server/db/tenant";
import type { BookingStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Jerusalem timezone helpers — mirrors the same logic in dashboard/queries.ts
// ---------------------------------------------------------------------------

const TZ = "Asia/Jerusalem";

function getJerusalemDayStart(refDate: Date): Date {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(refDate);

  const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  const s = parseInt(parts.find((p) => p.type === "second")!.value, 10);

  return new Date(
    refDate.getTime() - (h * 3600 + m * 60 + s) * 1000 - refDate.getMilliseconds(),
  );
}

function getJerusalemTodayBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = getJerusalemDayStart(now);
  const end = new Date(start.getTime() + 86400000 - 1);
  return { start, end };
}

const bookingInclude = {
  client: { select: { id: true, fullName: true, phone: true } },
  service: { select: { id: true, name: true, durationMinutes: true } },
} as const;

export interface ActiveCancellationPolicy {
  enabled: boolean;
  lateCancellationHours: number | null;
  lateCancellationFeeType: string;
  lateCancellationFeeAmount: string | null;
  lateCancellationFeePercentage: string | null;
}

export async function getActiveCancellationPolicy(
  tenant: TenantContext,
): Promise<ActiveCancellationPolicy | null> {
  const policy = await prisma.cancellationPolicy.findUnique({
    where: { businessId: tenant.businessId },
    select: {
      enabled: true,
      lateCancellationHours: true,
      lateCancellationFeeType: true,
      lateCancellationFeeAmount: true,
      lateCancellationFeePercentage: true,
    },
  });
  if (!policy || !policy.enabled) return null;
  return {
    ...policy,
    lateCancellationFeeAmount: policy.lateCancellationFeeAmount?.toString() ?? null,
    lateCancellationFeePercentage: policy.lateCancellationFeePercentage?.toString() ?? null,
  };
}

export type BookingWithRelations = Awaited<
  ReturnType<typeof getBooking>
> extends infer T
  ? T extends null
    ? never
    : T
  : never;

export type BookingListItem = Awaited<
  ReturnType<typeof getBookings>
>[number];

export type BookingFilter = "today" | "week" | "all";
export type BookingStatusFilter = "all" | "pending" | "active" | "completed" | "cancelled";
export type BookingSortField =
  | "startTime"
  | "price"
  | "duration"
  | "status"
  | "createdAt"
  | "clientName";
export type BookingSortDir = "asc" | "desc";

export interface GetBookingsParams {
  filter?: BookingFilter;
  statusFilter?: BookingStatusFilter;
  search?: string;
  serviceId?: string;
  depositStatusFilter?: string;
  sortField?: BookingSortField;
  sortDir?: BookingSortDir;
  smartSort?: boolean;
}

// Smart default sort: today → future requiring action → future → history (desc)
function applySmartSort<T extends { startTime: Date; status: string; depositStatus: string }>(
  bookings: T[],
): T[] {
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: TZ });

  function ds(d: Date) {
    return new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
  }

  function getGroup(b: T): number {
    const day = ds(b.startTime);
    if (day === todayStr) return 0;
    const isActive = b.status === "pending" || b.status === "approved";
    const needsAction = b.status === "pending" || (b.depositStatus === "pending" && isActive);
    const isFuture = day > todayStr;
    if (isFuture && needsAction) return 1;
    if (isFuture) return 2;
    return 3; // history
  }

  return [...bookings].sort((a, b) => {
    const ga = getGroup(a);
    const gb = getGroup(b);
    if (ga !== gb) return ga - gb;
    const ta = new Date(a.startTime).getTime();
    const tb = new Date(b.startTime).getTime();
    // history: most recent first; all others: ascending
    return ga === 3 ? tb - ta : ta - tb;
  });
}

const STATUS_FILTER_MAP: Record<BookingStatusFilter, BookingStatus[] | undefined> = {
  all: undefined,
  pending: ["pending"],
  active: ["pending", "approved"],
  completed: ["completed"],
  cancelled: ["cancelled", "no_show"],
};

// Maps sort field to Prisma orderBy key
const DB_SORT_FIELD: Partial<Record<BookingSortField, string>> = {
  startTime: "startTime",
  price: "priceSnapshot",
  duration: "durationMinutesSnapshot",
  status: "status",
  createdAt: "createdAt",
};

const VALID_DEPOSIT_STATUSES = ["not_required", "pending", "paid", "failed", "refunded"];

export async function getBookings(
  tenant: TenantContext,
  params: GetBookingsParams = {},
) {
  const {
    filter = "all",
    statusFilter = "all",
    search,
    serviceId,
    depositStatusFilter,
    sortField = "startTime",
    sortDir,
    smartSort = false,
  } = params;

  // Default sort direction: future-focused views go ascending, history goes newest-first
  const resolvedSortDir: BookingSortDir =
    sortDir ?? (filter === "all" && sortField === "startTime" ? "desc" : "asc");

  let startTimeFilter: { gte?: Date; lte?: Date } | undefined;

  if (filter === "today") {
    const { start, end } = getJerusalemTodayBounds();
    startTimeFilter = { gte: start, lte: end };
  } else if (filter === "week") {
    const { start } = getJerusalemTodayBounds();
    const weekEnd = new Date(start.getTime() + 7 * 86400000 - 1);
    startTimeFilter = { gte: start, lte: weekEnd };
  }

  const statuses = STATUS_FILTER_MAP[statusFilter];
  const validDeposit =
    depositStatusFilter && VALID_DEPOSIT_STATUSES.includes(depositStatusFilter)
      ? depositStatusFilter
      : undefined;

  // Smart sort and clientName sort are handled at app level; use startTime for DB ordering
  const dbSortKey =
    smartSort || sortField === "clientName"
      ? "startTime"
      : (DB_SORT_FIELD[sortField] ?? "startTime");
  const dbSortDir: BookingSortDir = smartSort ? "asc" : resolvedSortDir;

  const bookings = await prisma.booking.findMany({
    where: {
      businessId: tenant.businessId,
      ...(startTimeFilter ? { startTime: startTimeFilter } : {}),
      ...(statuses ? { status: { in: statuses } } : {}),
      ...(search
        ? {
            client: {
              OR: [
                { fullName: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
              ],
            },
          }
        : {}),
      ...(serviceId ? { serviceId } : {}),
      ...(validDeposit
        ? { depositStatus: validDeposit as "not_required" | "pending" | "paid" | "failed" | "refunded" }
        : {}),
    },
    include: bookingInclude,
    orderBy: { [dbSortKey]: dbSortDir },
  });

  if (smartSort) return applySmartSort(bookings);

  // App-level sort for client name (Hebrew-aware)
  if (sortField === "clientName") {
    bookings.sort((a, b) => {
      const cmp = a.client.fullName.localeCompare(b.client.fullName, "he");
      return resolvedSortDir === "asc" ? cmp : -cmp;
    });
  }

  return bookings;
}

export async function getBooking(tenant: TenantContext, bookingId: string) {
  return prisma.booking.findFirst({
    where: scopedWhere(tenant, { id: bookingId }),
    include: bookingInclude,
  });
}

export async function hasOverlap(
  tenant: TenantContext,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string,
): Promise<boolean> {
  const count = await prisma.booking.count({
    where: {
      businessId: tenant.businessId,
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      status: { in: ["pending", "approved"] },
      AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
    },
  });
  return count > 0;
}

export async function hasBookings(tenant: TenantContext): Promise<boolean> {
  const count = await prisma.booking.count({
    where: { businessId: tenant.businessId },
  });
  return count > 0;
}

export async function getPendingDepositBookings(tenant: TenantContext) {
  return prisma.booking.findMany({
    where: { businessId: tenant.businessId, depositStatus: "pending" },
    select: {
      id: true,
      startTime: true,
      depositAmountSnapshot: true,
      client: { select: { fullName: true } },
      service: { select: { name: true } },
    },
    orderBy: { startTime: "asc" },
  });
}

export interface BookingSummary {
  todayCount: number;
  weekCount: number;
  pendingCount: number;
  cancelledCount: number;
  pendingDepositCount: number;
}

// ---------------------------------------------------------------------------
// Calendar view
// ---------------------------------------------------------------------------

export type CalendarBookingItem = {
  id: string;
  clientName: string;
  clientId: string;
  clientPhone: string;
  serviceName: string;
  startTime: string; // ISO string
  endTime: string;
  status: string;
  priceSnapshot: number;
  durationMinutesSnapshot: number;
  notes: string | null;
};

export async function getCalendarBookings(
  tenant: TenantContext,
  dateFrom: Date,
  dateTo: Date,
): Promise<CalendarBookingItem[]> {
  const bookings = await prisma.booking.findMany({
    where: {
      businessId: tenant.businessId,
      startTime: { gte: dateFrom, lte: dateTo },
    },
    include: bookingInclude,
    orderBy: { startTime: "asc" },
  });

  return bookings.map((b) => ({
    id: b.id,
    clientName: b.client.fullName,
    clientId: b.client.id,
    clientPhone: b.client.phone,
    serviceName: b.service.name,
    startTime: b.startTime.toISOString(),
    endTime: b.endTime.toISOString(),
    status: b.status,
    priceSnapshot: Number(b.priceSnapshot),
    durationMinutesSnapshot: b.durationMinutesSnapshot,
    notes: b.notes ?? null,
  }));
}

export async function getLateCancellationsThisWeek(
  tenant: TenantContext,
): Promise<number> {
  const policy = await prisma.cancellationPolicy.findUnique({
    where: { businessId: tenant.businessId },
    select: { enabled: true, lateCancellationHours: true },
  });

  if (!policy?.enabled || !policy.lateCancellationHours) return 0;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recentCancelled = await prisma.booking.findMany({
    where: {
      businessId: tenant.businessId,
      status: { in: ["cancelled", "no_show"] },
      OR: [
        { cancelledAt: { gte: weekAgo } },
        { noShowAt: { gte: weekAgo } },
      ],
    },
    select: {
      cancelledAt: true,
      noShowAt: true,
      startTime: true,
    },
  });

  const hours = policy.lateCancellationHours;
  let count = 0;
  for (const b of recentCancelled) {
    const cancelTime = b.cancelledAt ?? b.noShowAt;
    if (!cancelTime) continue;
    const deadline = new Date(b.startTime.getTime() - hours * 60 * 60 * 1000);
    if (cancelTime >= deadline) count++;
  }

  return count;
}

export async function getBookingSummary(
  tenant: TenantContext,
): Promise<BookingSummary> {
  const { start: todayStart, end: todayEnd } = getJerusalemTodayBounds();
  const weekStart = todayStart;
  const weekEnd = new Date(todayStart.getTime() + 7 * 86400000 - 1);

  const [todayCount, weekCount, pendingCount, cancelledCount, pendingDepositCount] =
    await Promise.all([
      prisma.booking.count({
        where: {
          businessId: tenant.businessId,
          startTime: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.booking.count({
        where: {
          businessId: tenant.businessId,
          startTime: { gte: weekStart, lte: weekEnd },
        },
      }),
      prisma.booking.count({
        where: { businessId: tenant.businessId, status: "pending" },
      }),
      prisma.booking.count({
        where: {
          businessId: tenant.businessId,
          status: { in: ["cancelled", "no_show"] },
        },
      }),
      prisma.booking.count({
        where: { businessId: tenant.businessId, depositStatus: "pending" },
      }),
    ]);

  return { todayCount, weekCount, pendingCount, cancelledCount, pendingDepositCount };
}
