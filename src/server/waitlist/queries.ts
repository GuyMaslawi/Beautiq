import type { WaitlistStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";

const TZ = "Asia/Jerusalem";

export interface WaitlistEntryItem {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  serviceId: string | null;
  serviceName: string | null;
  preferredFrom: Date | null;
  preferredTo: Date | null;
  notes: string | null;
  status: WaitlistStatus;
  createdAt: Date;
}

/**
 * All waitlist entries for the business, active ones first, then most recent.
 * Terminal entries (booked / cancelled / expired) stay visible so the owner has
 * a short history, but they sort below the active queue.
 */
export async function getWaitlistEntries(
  tenant: TenantContext,
): Promise<WaitlistEntryItem[]> {
  const entries = await prisma.waitlistEntry.findMany({
    where: { businessId: tenant.businessId },
    include: {
      client: { select: { id: true, fullName: true, phone: true } },
      service: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // active first, then everything else; createdAt desc is preserved within groups.
  const rank = (s: WaitlistStatus) => (s === "active" ? 0 : s === "notified" ? 1 : 2);

  return entries
    .map((e) => ({
      id: e.id,
      clientId: e.client.id,
      clientName: e.client.fullName,
      clientPhone: e.client.phone,
      serviceId: e.service?.id ?? null,
      serviceName: e.service?.name ?? null,
      preferredFrom: e.preferredFrom,
      preferredTo: e.preferredTo,
      notes: e.notes,
      status: e.status,
      createdAt: e.createdAt,
    }))
    .sort((a, b) => rank(a.status) - rank(b.status));
}

/** Count of clients actively waiting — drives the dashboard opportunity card. */
export async function getActiveWaitlistCount(
  tenant: TenantContext,
): Promise<number> {
  return prisma.waitlistEntry.count({
    where: { businessId: tenant.businessId, status: "active" },
  });
}

export interface WaitlistCandidate extends WaitlistEntryItem {
  /** Exact service match AND the freed slot falls in the preferred time window. */
  isStrongMatch: boolean;
}

function jerusalemMinutesOfDay(d: Date): number {
  const s = d.toLocaleTimeString("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Candidate matching for a freed slot (used after a booking is cancelled).
 * Deliberately simple and understandable — no AI, no ranking engine:
 *   1. Only active entries.
 *   2. Service must match (or the entry is flexible on service).
 *   3. A "strong" match also has the freed slot's time-of-day inside the
 *      entry's preferred window (entries with no window are always time-OK).
 * Strong matches sort first, then the rest, then longest-waiting first.
 */
export async function getWaitlistMatchesForBooking(
  tenant: TenantContext,
  booking: { serviceId: string | null; startTime: Date },
): Promise<WaitlistCandidate[]> {
  const entries = await prisma.waitlistEntry.findMany({
    where: {
      businessId: tenant.businessId,
      status: "active",
      OR: [{ serviceId: null }, { serviceId: booking.serviceId ?? undefined }],
    },
    include: {
      client: { select: { id: true, fullName: true, phone: true } },
      service: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const slotMinutes = jerusalemMinutesOfDay(booking.startTime);

  const candidates: WaitlistCandidate[] = entries.map((e) => {
    const serviceExact =
      e.serviceId != null && e.serviceId === booking.serviceId;

    let timeOk = true;
    if (e.preferredFrom && e.preferredTo) {
      const from = jerusalemMinutesOfDay(e.preferredFrom);
      const to = jerusalemMinutesOfDay(e.preferredTo);
      timeOk = slotMinutes >= from && slotMinutes <= to;
    }

    return {
      id: e.id,
      clientId: e.client.id,
      clientName: e.client.fullName,
      clientPhone: e.client.phone,
      serviceId: e.service?.id ?? null,
      serviceName: e.service?.name ?? null,
      preferredFrom: e.preferredFrom,
      preferredTo: e.preferredTo,
      notes: e.notes,
      status: e.status,
      createdAt: e.createdAt,
      isStrongMatch: serviceExact && timeOk,
    };
  });

  return candidates.sort((a, b) => {
    if (a.isStrongMatch !== b.isStrongMatch) return a.isStrongMatch ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}
