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
export type BookingStatusFilter = "all" | "active" | "completed" | "cancelled";

const STATUS_FILTER_MAP: Record<BookingStatusFilter, BookingStatus[] | undefined> =
  {
    all: undefined,
    active: ["pending", "approved"],
    completed: ["completed"],
    cancelled: ["cancelled", "no_show"],
  };

export async function getBookings(
  tenant: TenantContext,
  filter: BookingFilter = "all",
  statusFilter: BookingStatusFilter = "all",
) {
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

  return prisma.booking.findMany({
    where: {
      businessId: tenant.businessId,
      ...(startTimeFilter ? { startTime: startTimeFilter } : {}),
      ...(statuses ? { status: { in: statuses } } : {}),
    },
    include: bookingInclude,
    // upcoming views stay chronological; "all" shows newest first
    orderBy: { startTime: filter === "all" ? "desc" : "asc" },
  });
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
