import { PremiumPageShell } from "@/components/premium/page-shell";
import {
  BringBackTabs,
  type HubTab,
  type HubSubTab,
} from "@/components/bring-back/bring-back-tabs";
import { BringBackOverviewSection } from "@/components/bring-back/sections/bring-back-overview-section";
import { RetentionSection } from "@/components/bring-back/sections/retention-section";
import { AtRiskSection } from "@/components/bring-back/sections/at-risk-section";
import { WinBackSection } from "@/components/bring-back/sections/win-back-section";
import { EmptySlotsSection } from "@/components/bring-back/sections/empty-slots-section";
import { ReputationSection } from "@/components/bring-back/sections/reputation-section";
import { MessagesSection } from "@/components/bring-back/sections/messages-section";
import { PlatinumLock } from "@/components/plans/platinum-lock";
import { hasPlatinumAccess } from "@/server/auth/session";

/** תת-כרטיסיות שהן פיצ׳ר פלטינום — נעולות למנויי פרימיום. */
const PLATINUM_SUBS: HubSubTab[] = ["at-risk", "campaigns"];

const VALID_TABS: HubTab[] = ["clients", "slots", "reviews", "messages"];
const VALID_SUBS: HubSubTab[] = ["overview", "retention", "at-risk", "campaigns"];

/**
 * מרכז "החזרת לקוחות" — מאחד מסכים חופפים (החזרת לקוחות, שימור, בסיכון,
 * קמפיינים, שעות ריקות, ביקורות, הודעות) לחוויית כרטיסיות אחת.
 * רק הכרטיסייה הפעילה נטענת מהשרת.
 */
export default async function BringBackPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    sub?: string;
    days?: string;
    campaign?: string;
  }>;
}) {
  const params = await searchParams;

  const tab: HubTab = VALID_TABS.includes(params.tab as HubTab)
    ? (params.tab as HubTab)
    : "clients";
  const sub: HubSubTab = VALID_SUBS.includes(params.sub as HubSubTab)
    ? (params.sub as HubSubTab)
    : "overview";

  const hasPlatinum = await hasPlatinumAccess();
  // חסימת גישה לתת-כרטיסייה שהיא פיצ׳ר פלטינום עבור מנויי פרימיום.
  const subLocked =
    tab === "clients" && PLATINUM_SUBS.includes(sub) && !hasPlatinum;

  return (
    <PremiumPageShell tint="plum" width="default">
      <BringBackTabs activeTab={tab} activeSub={sub} hasPlatinum={hasPlatinum} />

      {subLocked ? (
        <PlatinumLock
          feature={sub === "at-risk" ? "זיהוי לקוחות בסיכון" : "קמפיינים אוטומטיים"}
          description={
            sub === "at-risk"
              ? "גלי אילו לקוחות עלולות לא לחזור — לפני שהן נעלמות — עם פעולות מומלצות להחזרתן. זמין בתוכנית פלטינום."
              : "שליחת קמפיינים חכמים ב-WhatsApp להחזרת לקוחות שלא חזרו — באופן אוטומטי. זמין בתוכנית פלטינום."
          }
        />
      ) : (
        <>
          {tab === "clients" && sub === "overview" && (
            <BringBackOverviewSection days={params.days} />
          )}
          {tab === "clients" && sub === "retention" && <RetentionSection />}
          {tab === "clients" && sub === "at-risk" && <AtRiskSection />}
          {tab === "clients" && sub === "campaigns" && (
            <WinBackSection campaign={params.campaign} />
          )}
          {tab === "slots" && <EmptySlotsSection />}
          {tab === "reviews" && <ReputationSection />}
          {tab === "messages" && <MessagesSection />}
        </>
      )}
    </PremiumPageShell>
  );
}
