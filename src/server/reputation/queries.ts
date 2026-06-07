import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import { RECENT_COMPLETED_BOOKINGS_DAYS } from "@/lib/reputation/constants";

export interface ReputationBooking {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  completedAt: Date;
  price: number;
  isToday: boolean;
}

export interface ReputationSummary {
  recentCompletedCount: number;
}

function sinceDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() - RECENT_COMPLETED_BOOKINGS_DAYS);
  return d;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export async function getReputationBookings(
  tenant: TenantContext,
): Promise<ReputationBooking[]> {
  const since = sinceDate();

  const bookings = await prisma.booking.findMany({
    where: {
      businessId: tenant.businessId,
      status: "completed",
      startTime: { gte: since },
    },
    include: {
      client: { select: { id: true, fullName: true, phone: true } },
      service: { select: { name: true } },
    },
    orderBy: { startTime: "desc" },
  });

  return bookings.map((b) => ({
    id: b.id,
    clientId: b.client.id,
    clientName: b.client.fullName,
    clientPhone: b.client.phone,
    serviceName: b.service.name,
    completedAt: b.startTime,
    price: Number(b.priceSnapshot),
    isToday: isToday(b.startTime),
  }));
}

export async function getReputationSummary(
  tenant: TenantContext,
): Promise<ReputationSummary> {
  const since = sinceDate();

  const recentCompletedCount = await prisma.booking.count({
    where: {
      businessId: tenant.businessId,
      status: "completed",
      startTime: { gte: since },
    },
  });

  return { recentCompletedCount };
}

export async function getClientLatestCompletedBooking(
  tenant: TenantContext,
  clientId: string,
): Promise<ReputationBooking | null> {
  const since = sinceDate();

  const booking = await prisma.booking.findFirst({
    where: {
      businessId: tenant.businessId,
      clientId,
      status: "completed",
      startTime: { gte: since },
    },
    include: {
      client: { select: { id: true, fullName: true, phone: true } },
      service: { select: { name: true } },
    },
    orderBy: { startTime: "desc" },
  });

  if (!booking) return null;

  return {
    id: booking.id,
    clientId: booking.client.id,
    clientName: booking.client.fullName,
    clientPhone: booking.client.phone,
    serviceName: booking.service.name,
    completedAt: booking.startTime,
    price: Number(booking.priceSnapshot),
    isToday: isToday(booking.startTime),
  };
}
