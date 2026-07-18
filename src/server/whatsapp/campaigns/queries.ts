/**
 * Read-only campaign queries. Every query is scoped by businessId (tenant),
 * never by campaign id alone.
 */

import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import { maskPhone } from "@/lib/phone";
import type { CampaignCounts } from "./processor";

export interface CampaignListItem {
  id: string;
  templateName: string;
  status: string;
  audienceSummary: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  totalSelected: number;
  totalEligible: number;
  counts: CampaignCounts;
}

export interface CampaignRecipientRow {
  id: string;
  clientId: string;
  clientName: string;
  maskedPhone: string;
  status: string;
  skipReason: string | null;
  errorMessage: string | null;
}

export interface CampaignDetail extends CampaignListItem {
  recipients: CampaignRecipientRow[];
}

const EMPTY_COUNTS: CampaignCounts = {
  total: 0,
  queued: 0,
  processing: 0,
  accepted: 0,
  sent: 0,
  delivered: 0,
  read: 0,
  failed: 0,
  skipped: 0,
};

function accumulate(counts: CampaignCounts, status: string, n: number) {
  counts.total += n;
  if (status in counts) (counts as unknown as Record<string, number>)[status] += n;
}

export async function getCampaignsForBusiness(
  tenant: TenantContext,
  limit = 20,
): Promise<CampaignListItem[]> {
  const campaigns = await prisma.whatsAppCampaign.findMany({
    where: { businessId: tenant.businessId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  if (campaigns.length === 0) return [];

  const grouped = await prisma.whatsAppCampaignRecipient.groupBy({
    by: ["campaignId", "status"],
    where: { campaignId: { in: campaigns.map((c) => c.id) } },
    _count: { _all: true },
  });

  const countsByCampaign = new Map<string, CampaignCounts>();
  for (const c of campaigns) countsByCampaign.set(c.id, { ...EMPTY_COUNTS });
  for (const g of grouped) {
    const counts = countsByCampaign.get(g.campaignId);
    if (counts) accumulate(counts, g.status, g._count._all);
  }

  return campaigns.map((c) => ({
    id: c.id,
    templateName: c.templateName,
    status: c.status,
    audienceSummary: c.audienceSummary,
    createdAt: c.createdAt,
    startedAt: c.startedAt,
    completedAt: c.completedAt,
    totalSelected: c.totalSelected,
    totalEligible: c.totalEligible,
    counts: countsByCampaign.get(c.id) ?? { ...EMPTY_COUNTS },
  }));
}

export async function getCampaignDetail(
  tenant: TenantContext,
  campaignId: string,
): Promise<CampaignDetail | null> {
  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, businessId: tenant.businessId },
  });
  if (!campaign) return null;

  const recipients = await prisma.whatsAppCampaignRecipient.findMany({
    where: { campaignId: campaign.id, businessId: tenant.businessId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      clientId: true,
      normalizedPhone: true,
      status: true,
      skipReason: true,
      errorMessage: true,
      client: { select: { fullName: true } },
    },
  });

  const counts: CampaignCounts = { ...EMPTY_COUNTS };
  for (const r of recipients) accumulate(counts, r.status, 1);

  return {
    id: campaign.id,
    templateName: campaign.templateName,
    status: campaign.status,
    audienceSummary: campaign.audienceSummary,
    createdAt: campaign.createdAt,
    startedAt: campaign.startedAt,
    completedAt: campaign.completedAt,
    totalSelected: campaign.totalSelected,
    totalEligible: campaign.totalEligible,
    counts,
    recipients: recipients.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      clientName: r.client.fullName,
      maskedPhone: maskPhone(r.normalizedPhone),
      status: r.status,
      skipReason: r.skipReason,
      errorMessage: r.errorMessage,
    })),
  };
}
