import { AtRiskSection } from "@/components/bring-back/sections/at-risk-section";

/**
 * הנתיב המקורי נשמר ועובד, אך הוסר מהניווט ומנקודות הכניסה.
 * התוכן אוחד לכרטיסיית "בסיכון" במרכז /bring-back.
 */
export default function AtRiskPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <AtRiskSection />
    </div>
  );
}
