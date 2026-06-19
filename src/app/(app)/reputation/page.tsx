import { ReputationSection } from "@/components/bring-back/sections/reputation-section";

/**
 * הנתיב המקורי נשמר ועובד, אך הוסר מהניווט ומנקודות הכניסה.
 * התוכן אוחד לכרטיסיית "ביקורות" במרכז /bring-back.
 */
export default function ReputationPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <ReputationSection />
    </div>
  );
}
