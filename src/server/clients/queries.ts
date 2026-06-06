import type { BookingStatus, DepositStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import { scopedWhere } from "@/server/db/tenant";

// ---------------------------------------------------------------------------
// List types
// ---------------------------------------------------------------------------

export interface ClientUpcomingBooking {
  id: string;
  startTime: Date;
  serviceName: string;
}

export interface ClientListItem {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  lastVisitAt: Date | null;
  upcomingBooking: ClientUpcomingBooking | null;
  totalBookings: number;
  noShowCount: number;
  cancellationCount: number;
  totalSpent: number;
}

export interface ClientSummary {
  total: number;
  withUpcoming: number;
  withNoShow: number;
  notReturned: number;
}

// ---------------------------------------------------------------------------
// Detail types
// ---------------------------------------------------------------------------

export interface ClientBookingHistoryItem {
  id: string;
  status: BookingStatus;
  depositStatus: DepositStatus;
  startTime: Date;
  endTime: Date;
  priceSnapshot: Prisma.Decimal;
  durationMinutesSnapshot: number;
  service: { id: string; name: string };
}

export interface ClientStats {
  totalBookings: number;
  completedBookings: number;
  upcomingBookings: number;
  noShowCount: number;
  cancellationCount: number;
  totalSpent: number;
  lastVisitAt: Date | null;
  upcomingBooking: ClientUpcomingBooking | null;
}

export interface ClientDetail {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  createdAt: Date;
  bookings: ClientBookingHistoryItem[];
  stats: ClientStats;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getClients(
  tenant: TenantContext,
  opts: { search?: string } = {},
): Promise<ClientListItem[]> {
  const { search } = opts;

  const clients = await prisma.client.findMany({
    where: {
      businessId: tenant.businessId,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
              { normalizedPhone: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      bookings: {
        select: {
          id: true,
          status: true,
          startTime: true,
          priceSnapshot: true,
          service: { select: { name: true } },
        },
        orderBy: { startTime: "desc" },
      },
    },
    orderBy: { fullName: "asc" },
  });

  const now = new Date();

  return clients.map((client) => {
    const bookings = client.bookings;

    const completedBookings = bookings.filter((b) => b.status === "completed");
    const lastVisitAt =
      completedBookings.length > 0 ? completedBookings[0].startTime : null;

    const upcomingBookings = bookings
      .filter(
        (b) =>
          (b.status === "pending" || b.status === "approved") &&
          b.startTime > now,
      )
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    const upcomingBooking =
      upcomingBookings.length > 0
        ? {
            id: upcomingBookings[0].id,
            startTime: upcomingBookings[0].startTime,
            serviceName: upcomingBookings[0].service.name,
          }
        : null;

    const totalSpent = completedBookings.reduce(
      (sum, b) => sum + Number(b.priceSnapshot),
      0,
    );

    return {
      id: client.id,
      fullName: client.fullName,
      phone: client.phone,
      email: client.email,
      lastVisitAt,
      upcomingBooking,
      totalBookings: bookings.length,
      noShowCount: bookings.filter((b) => b.status === "no_show").length,
      cancellationCount: bookings.filter((b) => b.status === "cancelled")
        .length,
      totalSpent,
    };
  });
}

export async function getClientSummary(
  tenant: TenantContext,
): Promise<ClientSummary> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [total, withUpcoming, withNoShow, notReturned] = await Promise.all([
    prisma.client.count({
      where: { businessId: tenant.businessId },
    }),
    prisma.client.count({
      where: {
        businessId: tenant.businessId,
        bookings: {
          some: {
            status: { in: ["pending", "approved"] },
            startTime: { gt: now },
          },
        },
      },
    }),
    prisma.client.count({
      where: {
        businessId: tenant.businessId,
        bookings: { some: { status: "no_show" } },
      },
    }),
    // Clients who completed at least one booking >30 days ago and have no upcoming booking
    prisma.client.count({
      where: {
        businessId: tenant.businessId,
        bookings: {
          some: { status: "completed", startTime: { lt: thirtyDaysAgo } },
          none: {
            status: { in: ["pending", "approved"] },
            startTime: { gt: now },
          },
        },
      },
    }),
  ]);

  return { total, withUpcoming, withNoShow, notReturned };
}

export async function getClientBasic(
  tenant: TenantContext,
  clientId: string,
): Promise<{ id: string; fullName: string; phone: string } | null> {
  const client = await prisma.client.findFirst({
    where: scopedWhere(tenant, { id: clientId }),
    select: { id: true, fullName: true, phone: true },
  });
  return client ?? null;
}

export async function getClientDetail(
  tenant: TenantContext,
  clientId: string,
): Promise<ClientDetail | null> {
  const client = await prisma.client.findFirst({
    where: scopedWhere(tenant, { id: clientId }),
    include: {
      bookings: {
        include: {
          service: { select: { id: true, name: true } },
        },
        orderBy: { startTime: "desc" },
      },
    },
  });

  if (!client) return null;

  const now = new Date();
  const bookings = client.bookings;

  const completedBookings = bookings.filter((b) => b.status === "completed");
  const lastVisitAt =
    completedBookings.length > 0 ? completedBookings[0].startTime : null;

  const upcomingBookings = bookings
    .filter(
      (b) =>
        (b.status === "pending" || b.status === "approved") &&
        b.startTime > now,
    )
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const upcomingBooking =
    upcomingBookings.length > 0
      ? {
          id: upcomingBookings[0].id,
          startTime: upcomingBookings[0].startTime,
          serviceName: upcomingBookings[0].service.name,
        }
      : null;

  const totalSpent = completedBookings.reduce(
    (sum, b) => sum + Number(b.priceSnapshot),
    0,
  );

  return {
    id: client.id,
    fullName: client.fullName,
    phone: client.phone,
    email: client.email,
    notes: client.notes,
    createdAt: client.createdAt,
    bookings: bookings.map((b) => ({
      id: b.id,
      status: b.status,
      depositStatus: b.depositStatus,
      startTime: b.startTime,
      endTime: b.endTime,
      priceSnapshot: b.priceSnapshot,
      durationMinutesSnapshot: b.durationMinutesSnapshot,
      service: b.service,
    })),
    stats: {
      totalBookings: bookings.length,
      completedBookings: completedBookings.length,
      upcomingBookings: upcomingBookings.length,
      noShowCount: bookings.filter((b) => b.status === "no_show").length,
      cancellationCount: bookings.filter((b) => b.status === "cancelled")
        .length,
      totalSpent,
      lastVisitAt,
      upcomingBooking,
    },
  };
}
