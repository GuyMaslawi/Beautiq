import { PremiumPageShell } from "@/components/premium";
import { WinBackSection } from "@/components/bring-back/sections/win-back-section";
import { PlatinumLock } from "@/components/plans/platinum-lock";
import { hasPlatinumAccess } from "@/server/auth/session";

/**
 * הנתיב המקורי נשמר ועובד, אך הוסר מהניווט ומנקודות הכניסה.
 * התוכן אוחד לכרטיסיית "קמפיינים" במרכז /bring-back.
 * פיצ׳ר פלטינום — נעול למנויי פרימיום.
 */
export default async function WinBackCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const params = await searchParams;
  if (!(await hasPlatinumAccess())) {
    return (
      <PremiumPageShell tint="plum" width="default">
        <PlatinumLock
          feature="קמפיינים אוטומטיים"
          description="שליחת קמפיינים חכמים ב-WhatsApp להחזרת לקוחות שלא חזרו — באופן אוטומטי. זמין בתוכנית פלטינום."
        />
      </PremiumPageShell>
    );
  }
  return (
    <PremiumPageShell tint="plum" width="default">
      <WinBackSection campaign={params.campaign} />
    </PremiumPageShell>
  );
}
