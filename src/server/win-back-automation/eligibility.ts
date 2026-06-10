/**
 * Win-back eligibility engine.
 *
 * A client is eligible for an automatic win-back message if:
 *   1. Belongs to the business (tenant-scoped)
 *   2. Has at least one completed booking older than thresholdDays
 *   3. Has no upcoming booking (pending/approved in the future)
 *   4. Has a valid E.164 phone (normalizedPhone matches +972XXXXXXXXX)
 *   5. Has not been unsubscribed
 *   6. Has whatsappOptIn=true when requireOptIn is enabled
 *   7. Was not already contacted by this automation within cooldownDays
 */

import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import type { Prisma } from "@prisma/client";

const E164_REGEX = /^\+972\d{8,9}$/;

function isValidE164(phone: string): boolean {
  return E164_REGEX.test(phone);
}

export interface EligibleClient {
  id: string;
  fullName: string;
  phone: string;
  normalizedPhone: string;
  whatsappOptIn: boolean;
  lastVisitAt: Date;
  lastServiceName: string;
  lastBookingId: string;
  daysSinceLastVisit: number;
  totalCompletedBookings: number;
  totalRevenue: number;
}

export interface EligibilityOptions {
  thresholdDays: number;
  cooldownDays: number;
  requireOptIn: boolean;
}

/** Breakdown of why clients were excluded from the eligible set. */
export interface EligibilityBreakdown {
  /** Total clients checked */
  total: number;
  /** Clients eligible to receive a message */
  eligible: number;
  /** Excluded: no completed booking older than threshold */
  noCompletedBooking: number;
  /** Excluded: has an upcoming pending/approved booking */
  hasFutureBooking: number;
  /** Excluded: whatsappOptIn=false when requireOptIn=true */
  noOptIn: number;
  /** Excluded: normalizedPhone is not a valid E.164 Israeli number */
  invalidPhone: number;
  /** Excluded: was messaged by this automation within cooldownDays */
  inCooldown: number;
}

export async function getEligibleClients(
  tenant: TenantContext,
  options: EligibilityOptions,
): Promise<EligibleClient[]> {
  const { thresholdDays, cooldownDays, requireOptIn } = options;
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - thresholdDays * 24 * 60 * 60 * 1000);
  const cooldownDate = new Date(now.getTime() - cooldownDays * 24 * 60 * 60 * 1000);

  const whereOptIn: Prisma.ClientWhereInput = requireOptIn
    ? { whatsappOptIn: true }
    : {};

  const clients = await prisma.client.findMany({
    where: {
      businessId: tenant.businessId,
      unsubscribedAt: null,
      // Pre-filter to E.164 prefix — rules out empty/malformed phones before
      // doing the expensive booking joins
      normalizedPhone: { startsWith: "+972" },
      ...whereOptIn,
      bookings: {
        some: {
          businessId: tenant.businessId,
          status: "completed",
          startTime: { lt: thresholdDate },
        },
        none: {
          businessId: tenant.businessId,
          status: { in: ["pending", "approved"] },
          startTime: { gt: now },
        },
      },
      automationMessages: {
        none: {
          businessId: tenant.businessId,
          type: "win_back",
          status: { in: ["queued", "sent", "delivered", "read"] },
          createdAt: { gt: cooldownDate },
        },
      },
    },
    include: {
      bookings: {
        where: { businessId: tenant.businessId },
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
  });

  return clients
    .map((client) => {
      // Secondary validation: full E.164 regex (catches +972 with wrong length)
      if (!isValidE164(client.normalizedPhone)) return null;

      const completed = client.bookings.filter((b) => b.status === "completed");
      const last = completed[0];
      if (!last) return null;

      const daysSinceLastVisit = Math.floor(
        (now.getTime() - last.startTime.getTime()) / (1000 * 60 * 60 * 24),
      );

      const totalRevenue = completed.reduce(
        (sum, b) => sum + (b.priceSnapshot as Prisma.Decimal).toNumber(),
        0,
      );

      return {
        id: client.id,
        fullName: client.fullName,
        phone: client.phone,
        normalizedPhone: client.normalizedPhone,
        whatsappOptIn: client.whatsappOptIn,
        lastVisitAt: last.startTime,
        lastServiceName: last.service.name,
        lastBookingId: last.id,
        daysSinceLastVisit,
        totalCompletedBookings: completed.length,
        totalRevenue,
      };
    })
    .filter((c): c is EligibleClient => c !== null)
    .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);
}

/**
 * Returns a breakdown of why clients were included or excluded.
 * Used to display a transparent count panel in the UI.
 */
export async function getEligibilityBreakdown(
  tenant: TenantContext,
  options: EligibilityOptions,
): Promise<EligibilityBreakdown> {
  const { thresholdDays, cooldownDays, requireOptIn } = options;
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - thresholdDays * 24 * 60 * 60 * 1000);
  const cooldownDate = new Date(now.getTime() - cooldownDays * 24 * 60 * 60 * 1000);

  const [total, eligible, noOptIn, invalidPhone] = await Promise.all([
    // All active (not unsubscribed) clients
    prisma.client.count({
      where: { businessId: tenant.businessId, unsubscribedAt: null },
    }),

    // Fully eligible — reuse the main query count
    getEligibleClients(tenant, options).then((c) => c.length),

    // Missing opt-in (only relevant when requireOptIn=true)
    requireOptIn
      ? prisma.client.count({
          where: {
            businessId: tenant.businessId,
            unsubscribedAt: null,
            whatsappOptIn: false,
          },
        })
      : Promise.resolve(0),

    // Invalid phone (does not match E.164 +972 prefix)
    prisma.client.count({
      where: {
        businessId: tenant.businessId,
        unsubscribedAt: null,
        NOT: { normalizedPhone: { startsWith: "+972" } },
      },
    }),
  ]);

  // Clients with a valid phone but no completed booking older than threshold
  const noCompletedBooking = await prisma.client.count({
    where: {
      businessId: tenant.businessId,
      unsubscribedAt: null,
      normalizedPhone: { startsWith: "+972" },
      bookings: {
        none: {
          businessId: tenant.businessId,
          status: "completed",
          startTime: { lt: thresholdDate },
        },
      },
    },
  });

  // Clients with a valid phone, completed booking, but also an upcoming booking
  const hasFutureBooking = await prisma.client.count({
    where: {
      businessId: tenant.businessId,
      unsubscribedAt: null,
      normalizedPhone: { startsWith: "+972" },
      bookings: {
        some: {
          businessId: tenant.businessId,
          status: "completed",
          startTime: { lt: thresholdDate },
        },
      },
      AND: {
        bookings: {
          some: {
            businessId: tenant.businessId,
            status: { in: ["pending", "approved"] },
            startTime: { gt: now },
          },
        },
      },
    },
  });

  // Clients in cooldown
  const inCooldown = await prisma.client.count({
    where: {
      businessId: tenant.businessId,
      unsubscribedAt: null,
      normalizedPhone: { startsWith: "+972" },
      automationMessages: {
        some: {
          businessId: tenant.businessId,
          type: "win_back",
          status: { in: ["queued", "sent", "delivered", "read"] },
          createdAt: { gt: cooldownDate },
        },
      },
    },
  });

  return {
    total,
    eligible,
    noCompletedBooking,
    hasFutureBooking,
    noOptIn,
    invalidPhone,
    inCooldown,
  };
}
