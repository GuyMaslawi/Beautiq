import { MessagesSection } from "@/components/bring-back/sections/messages-section";

/**
 * הנתיב המקורי נשמר ועובד, אך הוסר מהניווט ומנקודות הכניסה.
 * התוכן אוחד לכרטיסיית "הודעות" במרכז /bring-back.
 */
export default function MessagesPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <MessagesSection />
    </div>
  );
}
