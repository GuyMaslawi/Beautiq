import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/server/auth/session";
import { AccountPlan } from "@prisma/client";
import { UpgradeClient } from "./upgrade-client";

export const metadata: Metadata = {
  title: "שדרוג לפלטינום · Allura",
};

/**
 * Premium → Platinum upgrade checkout. Requires a signed-in paying user; users
 * with no plan go to /subscribe first, and users already on Platinum (or admins)
 * skip straight to the dashboard.
 */
export default async function UpgradePage() {
  const user = await requireCurrentUser();
  if (!user.plan) redirect("/subscribe");
  if (user.plan === AccountPlan.platinum || user.isAdmin) redirect("/dashboard");

  return <UpgradeClient />;
}
