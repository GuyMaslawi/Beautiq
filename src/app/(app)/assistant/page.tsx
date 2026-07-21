import { Sparkles } from "lucide-react";
import { requireCurrentBusiness, hasPlatinumAccess } from "@/server/auth/session";
import { getAssistantContext } from "@/server/assistant/queries";
import { ASSISTANT } from "@/lib/constants/he";
import { PremiumPageShell, BeautyPageHero } from "@/components/premium";
import { PlatinumLock } from "@/components/plans/platinum-lock";
import { AssistantClient } from "@/components/assistant/assistant-client";

export default async function AssistantPage() {
  // פיצ׳ר פלטינום — נעול למנויי פרימיום.
  if (!(await hasPlatinumAccess())) {
    return (
      <PremiumPageShell tint="plum" width="default">
        <PlatinumLock
          feature="עוזר AI לניהול העסק"
          description="עוזר חכם שעונה על שאלות מתוך הנתונים האמיתיים של העסק שלך — הכנסות, לקוחות בסיכון, חלונות פנויים והמלצות לפעולה. זמין בתוכנית פלטינום."
        />
      </PremiumPageShell>
    );
  }

  const business = await requireCurrentBusiness();
  const context = await getAssistantContext({ businessId: business.id }, business.name);

  return (
    <PremiumPageShell tint="plum" width="narrow" className="pb-10">
      <BeautyPageHero
        icon={Sparkles}
        eyebrow={ASSISTANT.eyebrow}
        title={ASSISTANT.pageTitle}
        subtitle={ASSISTANT.pageSubtitle}
        tint="plum"
      />

      <AssistantClient context={context} />
    </PremiumPageShell>
  );
}
