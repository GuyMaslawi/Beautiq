import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/server/auth/session";
import { SubscribeClient } from "./subscribe-client";

export const metadata: Metadata = {
  title: "בחירת תוכנית · Allura",
};

/**
 * The paywall shown right after signup. A signed-in user who has not yet chosen
 * & paid for a plan picks Premium or Platinum here; only once paid does the app
 * gate (see (app)/layout.tsx) let them into the dashboard. Users who already
 * have a plan — or admins — skip straight to the app.
 */
export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ pending?: string }>;
}) {
  const user = await requireCurrentUser();
  if (user.plan || user.isAdmin) redirect("/dashboard");

  // /api/subscription/return שולח לכאן עם pending=1 כשהמשתמשת חזרה מעמוד התשלום
  // אך אישור השרת של Grow טרם נקלט. בלי לקרוא את הפרמטר הזה המסך היה נראה לה
  // כאילו התשלום לא נקלט כלל, והיא הייתה משלמת פעם שנייה.
  const { pending } = await searchParams;

  return (
    <SubscribeClient userName={user.name ?? null} paymentPending={pending === "1"} />
  );
}
