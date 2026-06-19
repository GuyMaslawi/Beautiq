import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";

export type AutomationMessageLogItem = {
  id: string;
  type: string;
  status: string;
  clientName: string;
  clientId: string;
  bookingId: string | null;
  failureReason: string | null;
  sentAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  retryCount: number;
  lastRetryAt: Date | null;
};

export async function getAutomationMessageLog(
  tenant: TenantContext,
  options: { limit?: number } = {},
): Promise<AutomationMessageLogItem[]> {
  const { limit = 50 } = options;

  const messages = await prisma.automationMessage.findMany({
    where: { businessId: tenant.businessId },
    include: {
      client: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return messages.map((m) => ({
    id: m.id,
    type: m.type,
    status: m.status,
    clientName: m.client.fullName,
    clientId: m.client.id,
    bookingId: m.bookingId,
    failureReason: m.failureReason,
    sentAt: m.sentAt,
    failedAt: m.failedAt,
    createdAt: m.createdAt,
    retryCount: m.retryCount,
    lastRetryAt: m.lastRetryAt,
  }));
}

export type WhatsAppActivityStats = {
  /** Messages actually sent in the last 7 days. */
  sentThisWeek: number;
  /** Of those, how many WhatsApp reported delivered. */
  deliveredThisWeek: number;
  /** Failed send attempts in the last 7 days. */
  failedThisWeek: number;
  /** Most recent send across all time — powers "last activity". */
  lastActivityAt: Date | null;
};

/**
 * Lightweight WhatsApp activity summary for the connected-state operational
 * card on the automations page. Reuses the AutomationMessage audit trail; no
 * new tables. Returns zeros / null when there is nothing yet, so the UI can
 * show only the information that actually exists.
 */
export async function getWhatsAppActivityStats(
  tenant: TenantContext,
): Promise<WhatsAppActivityStats> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const businessId = tenant.businessId;

  const [sentThisWeek, deliveredThisWeek, failedThisWeek, last] = await Promise.all([
    prisma.automationMessage.count({
      where: { businessId, sentAt: { gte: weekAgo } },
    }),
    prisma.automationMessage.count({
      where: { businessId, deliveredAt: { gte: weekAgo } },
    }),
    prisma.automationMessage.count({
      where: { businessId, failedAt: { gte: weekAgo } },
    }),
    prisma.automationMessage.findFirst({
      where: { businessId, sentAt: { not: null } },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    }),
  ]);

  return {
    sentThisWeek,
    deliveredThisWeek,
    failedThisWeek,
    lastActivityAt: last?.sentAt ?? null,
  };
}
