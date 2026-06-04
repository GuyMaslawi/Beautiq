import { requireCurrentBusiness } from "@/server/auth/session";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PLACEHOLDERS } from "@/lib/constants/he";

export default async function ServicesPage() {
  await requireCurrentBusiness();
  return (
    <PlaceholderPage
      title={PLACEHOLDERS.services.title}
      message={PLACEHOLDERS.services.message}
    />
  );
}
