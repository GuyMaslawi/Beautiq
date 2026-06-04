import { redirect } from "next/navigation";

// Business creation now happens inside the dashboard setup card. This legacy
// route is kept only as an internal fallback and redirects into the app.
export default function OnboardingBusinessPage() {
  redirect("/dashboard");
}
