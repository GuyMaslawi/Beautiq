import { Megaphone } from "lucide-react";
import { EditorialSectionHeader } from "@/components/premium";
import { requireCurrentBusiness } from "@/server/auth/session";
import {
  getWinBackAllCampaigns,
  computeWinBackMetrics,
  type CampaignType,
} from "@/server/win-back-campaigns/queries";
import { CampaignView } from "@/components/win-back-campaigns/campaign-view";
import { WIN_BACK } from "@/lib/constants/he";

const VALID_CAMPAIGN_TYPES: CampaignType[] = ["30", "60", "90", "vip"];

/** קמפיינים להחזרה — בונה קמפיין רב-שלבי עם מעקב שליחה. */
export async function WinBackSection({ campaign }: { campaign?: string }) {
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };

  const allCampaigns = await getWinBackAllCampaigns(tenant);
  const metrics = computeWinBackMetrics(allCampaigns);

  const defaultCampaignType = VALID_CAMPAIGN_TYPES.includes(
    campaign as CampaignType,
  )
    ? (campaign as CampaignType)
    : undefined;

  return (
    <div className="w-full space-y-6" dir="rtl">
      <EditorialSectionHeader
        icon={<Megaphone className="h-4 w-4" />}
        eyebrow="קמפיין החזרה"
        title={WIN_BACK.pageTitle}
        description={WIN_BACK.pageSubtitle}
        tint="plum"
        action={
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-bold"
            style={{
              background: "rgba(172,92,127,0.12)",
              color: "#ac5c7f",
              border: "1px solid rgba(172,92,127,0.25)",
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
