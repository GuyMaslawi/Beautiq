import { redirect } from "next/navigation";

// The old onboarding wizard has been folded into the dashboard. Keep this route
// as a harmless fallback that lands users in the app shell.
export default function OnboardingIndexPage() {
  redirect("/dashboard");
}
