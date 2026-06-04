import { requireCurrentBusiness } from "@/server/auth/session";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PLACEHOLDERS } from "@/lib/constants/he";

export default async function SettingsPage() {
  await requireCurrentBusiness();
  return (
    <PlaceholderPage
      title={PLACEHOLDERS.settings.title}
      message={PLACEHOLDERS.settings.message}
    />
  );
}
