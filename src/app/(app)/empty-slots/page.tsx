import { PremiumPageShell } from "@/components/premium";
import { EmptySlotsSection } from "@/components/bring-back/sections/empty-slots-section";

/**
 * הנתיב המקורי נשמר ועובד, אך הוסר מהניווט ומנקודות הכניסה.
 * התוכן אוחד לכרטיסיית "מילוי שעות ריקות" במרכז /bring-back.
 */
export default function EmptySlotsPage() {
  return (
    <PremiumPageShell tint="plum" width="default">
      <EmptySlotsSection />
    </PremiumPageShell>
  );
}
