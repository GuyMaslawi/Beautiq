import { PremiumPageShell } from "@/components/premium";
import { RetentionSection } from "@/components/bring-back/sections/retention-section";

/**
 * הנתיב המקורי נשמר ועובד, אך הוסר מהניווט ומנקודות הכניסה.
 * התוכן אוחד לכרטיסיית "שימור" במרכז /bring-back.
 */
export default function RetentionPage() {
  return (
    <PremiumPageShell tint="plum" width="default">
      <RetentionSection />
    </PremiumPageShell>
  );
}
