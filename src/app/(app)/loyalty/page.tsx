import { Gift } from "lucide-react";
import { requireCurrentBusiness, hasPlatinumAccess } from "@/server/auth/session";
import { getLoyaltyOverview } from "@/server/loyalty/queries";
import { LOYALTY } from "@/lib/constants/he";
import { PremiumPageShell, BeautyPageHero } from "@/components/premium";
import { PlatinumLock } from "@/components/plans/platinum-lock";
import { LoyaltyClient } from "@/components/loyalty/loyalty-client";

export default async function LoyaltyPage() {
  // פיצ׳ר פלטינום — נעול למנויי פרימיום.
  if (!(await hasPlatinumAccess())) {
    return (
      <PremiumPageShell tint="rose" width="default">
        <PlatinumLock
          feature="מועדון נאמנות ללקוחות"
          description="כרטיסיית ביקורים חכמה שמתגמלת לקוחות חוזרות — עוקבת אוטומטית לפי התורים שהושלמו ומראה לך בדיוק מי זכאית להטבה. זמין בתוכנית פלטינום."
        />
      </PremiumPageShell>
    );
  }

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
