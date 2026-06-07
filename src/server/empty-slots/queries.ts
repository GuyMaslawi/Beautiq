import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import {
  findEmptySlots,
  type EmptySlot,
} from "@/lib/empty-slots/find-empty-slots";

const TZ = "Asia/Jerusalem";
const LOST_CLIENT_DAYS = 30;
const MIN_GAP_MINUTES = 30;
const LOOK_AHEAD_DAYS = 7;
const MAX_SLOTS = 5;
const MAX_SUGGESTED_CLIENTS = 3;

export type { EmptySlot };

export interface SuggestedClient {
  id: string;
  fullName: string;
  phone: string;
  lastVisitAtISO: string | null;
}

export interface EmptySlotsData {
  slots: EmptySlot[];
  suggestedClients: SuggestedClient[];
}

function getJerusalemMidnightUTC(refDate: Date): Date {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(refDate);
  const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  return new Date(refDate.getTime() - (h * 60 + m) * 60000);
}

export async function getEmptySlotsData(
  tenant: TenantContext,
): Promise<EmptySlotsData> {
  const now = new Date();
  const todayStart = getJerusalemMidnightUTC(now);
  // Query a window slightly wider than the look-ahead to catch edge-of-day exceptions.
  const queryEnd = new Date(
    now.getTime() + (LOOK_AHEAD_DAYS + 2) * 86400000,
  );
  const thresholdDate = new Date(
    now.getTime() - LOST_CLIENT_DAYS * 86400000,
  );

  const [activeServices, rules, exceptions, bookings, rawClients] =
    await Promise.all([
      prisma.service.findMany({
        where: { businessId: tenant.businessId, isActive: true },
        select: { durationMinutes: true },
        orderBy: { durationMinutes: "asc" },
      }),

      prisma.availabilityRule.findMany({
        where: { businessId: tenant.businessId, isActive: true },
        select: { weekday: true, startMinutes: true, endMinutes: true },
      }),

      prisma.availabilityException.findMany({
        where: {
          businessId: tenant.businessId,
          date: { gte: todayStart, lte: queryEnd },
        },
        select: {
          date: true,
          type: true,
          startMinutes: true,
          endMinutes: true,
        },
      }),

      // Only pending/approved bookings block future slots.
      prisma.booking.findMany({
        where: {
          businessId: tenant.businessId,
          status: { in: ["pending", "approved"] },
          endTime: { gte: todayStart },
          startTime: { lte: queryEnd },
        },
        select: { startTime: true, endTime: true },
      }),

      // Suggested clients: at least one completed booking older than 30 days,
      // no pending/approved upcoming booking.
      prisma.client.findMany({
        where: {
          businessId: tenant.businessId,
          bookings: {
            some: {
              status: "completed",
              startTime: { lt: thresholdDate },
            },
            none: {
              status: { in: ["pending", "approved"] },
              startTime: { gt: now },
            },
          },
        },
        select: {
          id: true,
          fullName: true,
          phone: true,
          lastVisitAt: true,
        },
        orderBy: { lastVisitAt: "asc" }, // longest since last visit first
        take: MAX_SUGGESTED_CLIENTS,
      }),
    ]);

  // No services = no meaningful slots to surface.
  if (activeServices.length === 0) {
    return { slots: [], suggestedClients: [] };
  }

  const minGap = Math.max(activeServices[0].durationMinutes, MIN_GAP_MINUTES);

  const slots = findEmptySlots(
    rules,
    exceptions.map((e) => ({
      date: e.date,
      type: e.type as "closed" | "custom_hours",
      startMinutes: e.startMinutes,
      endMinutes: e.endMinutes,
    })),
    bookings,
    minGap,
    LOOK_AHEAD_DAYS,
  ).slice(0, MAX_SLOTS);

  const suggestedClients: SuggestedClient[] = rawClients.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    phone: c.phone,
    lastVisitAtISO: c.lastVisitAt ? c.lastVisitAt.toISOString() : null,
  }));

  return { slots, suggestedClients };
}
