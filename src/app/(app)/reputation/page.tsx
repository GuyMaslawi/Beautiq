import { PremiumPageShell } from "@/components/premium";
import { ReputationSection } from "@/components/bring-back/sections/reputation-section";

/**
 * הנתיב המקורי נשמר ועובד, אך הוסר מהניווט ומנקודות הכניסה.
 * התוכן אוחד לכרטיסיית "ביקורות" במרכז /bring-back.
 */
export default function ReputationPage() {
  return (
    <PremiumPageShell tint="plum" width="default">
      <ReputationSection />
    </PremiumPageShell>
  );
}
