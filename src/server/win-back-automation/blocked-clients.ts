/**
 * Returns the primary blocking reason for every client in the business,
 * using a fixed priority so each client is counted in exactly one bucket.
 *
 * Priority (highest → lowest):
 *   1. invalidPhone      — no valid E.164 Israeli number
 *   2. unsubscribed      — unsubscribedAt is set
 *   3. noOptIn           — requireOptIn=true and whatsappOptIn=false
 *   4. hasFutureBooking  — has a pending/approved booking in the future
 *   5. inCooldown        — messaged by win_back within cooldownDays
 *   6. noCompletedBooking — no completed booking older than thresholdDays
 *   7. eligible          — passes all checks
 */

import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";

const E164_REGEX = /^\+972\d{8,9}$/;

function isValidE164(phone: string): boolean {
  return E164_REGEX.test(phone ?? "");
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return "****";
  return "****" + phone.slice(-4);
}

export type BlockingReason =
  | "invalidPhone"
  | "unsubscribed"
  | "noOptIn"
  | "hasFutureBooking"
  | "inCooldown"
  | "noCompletedBooking"
  | "eligible";

export interface BlockedClientPreview {
  id: string;
  fullName: string;
  maskedPhone: string;
}

export interface BlockedClientsByReason {
  invalidPhone: BlockedClientPreview[];
  unsubscribed: BlockedClientPreview[];
  noOptIn: BlockedClientPreview[];
  hasFutureBooking: BlockedClientPreview[];
  inCooldown: BlockedClientPreview[];
  noCompletedBooking: BlockedClientPreview[];
  counts: {
    total: number;
    eligible: number;
    invalidPhone: number;
    unsubscribed: number;
    noOptIn: number;
    hasFutureBooking: number;
    inCooldown: number;
    noCompletedBooking: number;
  };
}

export interface BlockedClientsOptions {
  thresholdDays: number;
  cooldownDays: number;
  requireOptIn: boolean;
  ignoreCooldown?: boolean;
}

const MAX_CLIENTS_PER_REASON = 50;

export async function getBlockedClientsByReason(
  tenant: TenantContext,
  options: BlockedClientsOptions,
): Promise<BlockedClientsByReason> {
  const { thresholdDays, cooldownDays, requireOptIn, ignoreCooldown } = options;
  const now = new Date();
  const thresholdDate = new Date(
    now.getTime() - thresholdDays * 24 * 60 * 60 * 1000,
  );
  const cooldownDate = new Date(
    now.getTime() - cooldownDays * 24 * 60 * 60 * 1000,
  );

  const clients = await prisma.client.findMany({
    where: { businessId: tenant.businessId },
    select: {
      id: true,
      fullName: true,
      phone: true,
      normalizedPhone: true,
      whatsappOptIn: true,
      unsubscribedAt: true,
      bookings: {
        where: { businessId: tenant.businessId },
        select: { status: true, startTime: true },
      },
      automationMessages: {
        where: {
          businessId: tenant.businessId,
          type: "win_back",
          status: { in: ["queued", "sent", "delivered", "read"] },
          createdAt: { gt: cooldownDate },
        },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { fullName: "asc" },
  });

  const result: BlockedClientsByReason = {
    invalidPhone: [],
    unsubscribed: [],
    noOptIn: [],
    hasFutureBooking: [],
    inCooldown: [],
    noCompletedBooking: [],
    counts: {
      total: clients.length,
      eligible: 0,
      invalidPhone: 0,
      unsubscribed: 0,
      noOptIn: 0,
      hasFutureBooking: 0,
      inCooldown: 0,
      noCompletedBooking: 0,
    },
  };

  for (const client of clients) {
    const preview: BlockedClientPreview = {
      id: client.id,
      fullName: client.fullName,
      maskedPhone: maskPhone(client.normalizedPhone || client.phone),
    };

    let reason: BlockingReason;

    if (!isValidE164(client.normalizedPhone)) {
      reason = "invalidPhone";
    } else if (client.unsubscribedAt !== null) {
      reason = "unsubscribed";
    } else if (requireOptIn && !client.whatsappOptIn) {
      reason = "noOptIn";
    } else {
      const hasFutureBook = client.bookings.some(
        (b) =>
          (b.status === "pending" || b.status === "approved") &&
          b.startTime > now,
      );
      if (hasFutureBook) {
        reason = "hasFutureBooking";
      } else if (!ignoreCooldown && client.automationMessages.length > 0) {
        reason = "inCooldown";
      } else {
        const hasOldCompleted = client.bookings.some(
          (b) => b.status === "completed" && b.startTime < thresholdDate,
        );
        reason = hasOldCompleted ? "eligible" : "noCompletedBooking";
      }
    }

    if (reason === "eligible") {
      result.counts.eligible++;
    } else {
      result.counts[reason]++;
      const list = getReasonList(result, reason);
      if (list.length < MAX_CLIENTS_PER_REASON) {
        list.push(preview);
      }
    }
  }

  return result;
}

function getReasonList(
  result: BlockedClientsByReason,
  reason: Exclude<BlockingReason, "eligible">,
): BlockedClientPreview[] {
  switch (reason) {
    case "invalidPhone":
      return result.invalidPhone;
    case "unsubscribed":
      return result.unsubscribed;
    case "noOptIn":
      return result.noOptIn;
    case "hasFutureBooking":
      return result.hasFutureBooking;
    case "inCooldown":
      return result.inCooldown;
    case "noCompletedBooking":
      return result.noCompletedBooking;
  }
}
