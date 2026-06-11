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
