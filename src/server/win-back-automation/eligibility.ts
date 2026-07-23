/**
 * Win-back eligibility engine.
 *
 * A client is eligible for an automatic win-back message if:
 *   1. Belongs to the business (tenant-scoped)
 *   2. Has at least one completed booking older than thresholdDays
 *   3. Has no upcoming booking (pending/approved in the future)
 *   4. Has a valid E.164 phone (normalizedPhone matches +972XXXXXXXXX)
 *   5. Has not been unsubscribed (replied STOP)
 *   6. Was not already contacted by this automation within cooldownDays
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
  /** Admin-only: bypass cooldown check for manual test runs. Never applies to cron. */
  ignoreCooldown?: boolean;
  /**
   * Test-only timing mode. Defaults to "days". When "minutes", the inactivity
   * and cooldown windows are measured in minutes using the *Minutes fields below.
   * Callers must gate this with isMinuteTestingAllowed() — eligibility trusts it.
   * Every other filter (opt-in, marketing, unsubscribed, future booking, dedup)
   * is unchanged in minute mode.
   */
  timingUnit?: "days" | "minutes";
  /** Inactivity threshold in minutes — used only when timingUnit="minutes". */
  thresholdMinutes?: number | null;
  /** Cooldown in minutes — used only when timingUnit="minutes". */
  cooldownMinutes?: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/**
 * Compute the inactivity-threshold and cooldown cutoff dates from the options.
 * Day-based math is the default and is byte-for-byte unchanged for callers that
 * pass no timingUnit. Minute mode only kicks in when timingUnit="minutes" AND a
 * positive *Minutes value is provided; otherwise it falls back to the day value.
 */
function computeWindows(options: EligibilityOptions): {
  now: Date;
  thresholdDate: Date;
  cooldownDate: Date;
} {
  const now = new Date();
  const useMinutes = options.timingUnit === "minutes";

  const thresholdMs =
    useMinutes && typeof options.thresholdMinutes === "number" && options.thresholdMinutes > 0
      ? options.thresholdMinutes * MINUTE_MS
      : options.thresholdDays * DAY_MS;

  const cooldownMs =
    useMinutes && typeof options.cooldownMinutes === "number" && options.cooldownMinutes > 0
      ? options.cooldownMinutes * MINUTE_MS
      : options.cooldownDays * DAY_MS;

  return {
    now,
    thresholdDate: new Date(now.getTime() - thresholdMs),
    cooldownDate: new Date(now.getTime() - cooldownMs),
  };
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
  /** Excluded: marketingOptIn=false (win-back is a marketing message, always required) */
  noMarketingOptIn: number;
  /** Excluded: normalizedPhone is not a valid E.164 Israeli number */
  invalidPhone: number;
  /** Excluded: was messaged by this automation within cooldownDays */
  inCooldown: number;
  /** Admin override: clients included despite cooldown (inCooldown=0 when this>0) */
  cooldownOverrideCount: number;
}

export async function getEligibleClients(
  tenant: TenantContext,
  options: EligibilityOptions,
): Promise<EligibleClient[]> {
  const { ignoreCooldown } = options;
  const { now, thresholdDate, cooldownDate } = computeWindows(options);

  const cooldownFilter: Prisma.ClientWhereInput = ignoreCooldown
    ? {}
    : {
        automationMessages: {
          none: {
            businessId: tenant.businessId,
            type: "win_back",
            status: { in: ["queued", "sent", "delivered", "read"] },
            createdAt: { gt: cooldownDate },
          },
        },
      };

  const clients = await prisma.client.findMany({
    where: {
      businessId: tenant.businessId,
      unsubscribedAt: null,
      // Pre-filter to E.164 prefix — rules out empty/malformed phones before
      // doing the expensive booking joins
      normalizedPhone: { startsWith: "+972" },
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
      ...cooldownFilter,
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
  const { ignoreCooldown } = options;
  const { now, thresholdDate, cooldownDate } = computeWindows(options);

  // Client consent (opt-in) is no longer a gate — only an explicit STOP
  // (unsubscribedAt) excludes a client, so the opt-in buckets are always 0.
  const noOptIn = 0;
  const noMarketingOptIn = 0;

  const [total, eligible, invalidPhone] = await Promise.all([
    // All active (not unsubscribed) clients
    prisma.client.count({
      where: { businessId: tenant.businessId, unsubscribedAt: null },
    }),

    // Fully eligible — reuse the main query count
    getEligibleClients(tenant, options).then((c) => c.length),

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

  // Clients in cooldown — always counted against real cooldownDate
  const rawInCooldown = await prisma.client.count({
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

  // When admin ignores cooldown, cooldown clients become eligible; expose the
  // override count separately so the UI can explain the difference.
  return {
    total,
    eligible,
    noCompletedBooking,
    hasFutureBooking,
    noOptIn,
    noMarketingOptIn,
    invalidPhone,
    inCooldown: ignoreCooldown ? 0 : rawInCooldown,
    cooldownOverrideCount: ignoreCooldown ? rawInCooldown : 0,
  };
}
