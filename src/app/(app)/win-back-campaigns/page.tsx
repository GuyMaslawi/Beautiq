import { WinBackSection } from "@/components/bring-back/sections/win-back-section";

/**
 * הנתיב המקורי נשמר ועובד, אך הוסר מהניווט ומנקודות הכניסה.
 * התוכן אוחד לכרטיסיית "קמפיינים" במרכז /bring-back.
 */
export default async function WinBackCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto w-full max-w-3xl">
      <WinBackSection campaign={params.campaign} />
    </div>
  );
}
