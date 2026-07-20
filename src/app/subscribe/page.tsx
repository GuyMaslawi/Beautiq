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
export default async function SubscribePage() {
  const user = await requireCurrentUser();
  if (user.plan || user.isAdmin) redirect("/dashboard");

  return <SubscribeClient userName={user.name ?? null} />;
}
