import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireCurrentBusiness } from "@/server/auth/session";
import {
  getWinBackAllCampaigns,
  computeWinBackMetrics,
  type CampaignType,
} from "@/server/win-back-campaigns/queries";
import { CampaignView } from "@/components/win-back-campaigns/campaign-view";
import { WIN_BACK } from "@/lib/constants/he";

const VALID_CAMPAIGN_TYPES: CampaignType[] = ["30", "60", "90", "vip"];

export default async function WinBackCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const [business, params] = await Promise.all([
    requireCurrentBusiness(),
    searchParams,
  ]);

  const tenant = { businessId: business.id };
  const allCampaigns = await getWinBackAllCampaigns(tenant);
  const metrics = computeWinBackMetrics(allCampaigns);

  const defaultCampaignType = VALID_CAMPAIGN_TYPES.includes(
    params.campaign as CampaignType,
  )
    ? (params.campaign as CampaignType)
    : undefined;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6" dir="rtl">
      <PageHeader
        icon={Megaphone}
        title={WIN_BACK.pageTitle}
        subtitle={WIN_BACK.pageSubtitle}
        action={
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-bold"
            style={{
              background: "rgba(184,107,140,0.12)",
              color: "#b86b8c",
              border: "1px solid rgba(184,107,140,0.25)",
            }}
          >
            {WIN_BACK.proBadge}
          </span>
        }
      />

      <CampaignView
        allCampaigns={allCampaigns}
        metrics={metrics}
        businessName={business.name}
        defaultCampaignType={defaultCampaignType}
      />
    </div>
  );
}
