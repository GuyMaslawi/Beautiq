import { PremiumPageShell } from "@/components/premium";
import { AtRiskSection } from "@/components/bring-back/sections/at-risk-section";
import { PlatinumLock } from "@/components/plans/platinum-lock";
import { hasPlatinumAccess } from "@/server/auth/session";

/**
 * הנתיב המקורי נשמר ועובד, אך הוסר מהניווט ומנקודות הכניסה.
 * התוכן אוחד לכרטיסיית "בסיכון" במרכז /bring-back.
 * פיצ׳ר פלטינום — נעול למנויי פרימיום.
 */
export default async function AtRiskPage() {
  if (!(await hasPlatinumAccess())) {
    return (
      <PremiumPageShell tint="plum" width="default">
        <PlatinumLock
          feature="זיהוי לקוחות בסיכון"
          description="גלי אילו לקוחות עלולות לא לחזור — לפני שהן נעלמות — עם פעולות מומלצות להחזרתן. זמין בתוכנית פלטינום."
        />
      </PremiumPageShell>
    );
  }
  return (
    <PremiumPageShell tint="plum" width="default">
      <AtRiskSection />
    </PremiumPageShell>
  );
}
