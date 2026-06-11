import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import type { AutomationSetting } from "@prisma/client";

export async function getReviewRequestSetting(
  tenant: TenantContext,
): Promise<AutomationSetting | null> {
  return prisma.automationSetting.findUnique({
    where: { businessId_type: { businessId: tenant.businessId, type: "review_request" } },
  });
}

export interface ReviewRequestStats {
  sentThisMonth: number;
}

export async function getReviewRequestStatsThisMonth(
  tenant: TenantContext,
): Promise<ReviewRequestStats> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const sentThisMonth = await prisma.booking.count({
    where: {
      businessId: tenant.businessId,
      reviewRequestSentAt: { gte: monthStart },
    },
  });

  return { sentThisMonth };
}
