import { Gift } from "lucide-react";
import { requireCurrentBusiness } from "@/server/auth/session";
import { getLoyaltyOverview } from "@/server/loyalty/queries";
import { LOYALTY } from "@/lib/constants/he";
import { PremiumPageShell, BeautyPageHero } from "@/components/premium";
import { LoyaltyClient } from "@/components/loyalty/loyalty-client";

export default async function LoyaltyPage() {
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };

  const overview = await getLoyaltyOverview(tenant);

  return (
    <PremiumPageShell tint="rose" width="default" className="pb-10">
      <BeautyPageHero
        icon={Gift}
        eyebrow={LOYALTY.eyebrow}
        title={LOYALTY.pageTitle}
        subtitle={LOYALTY.pageSubtitle}
        tint="rose"
      />

      <LoyaltyClient overview={overview} businessName={business.name} />
    </PremiumPageShell>
  );
}
