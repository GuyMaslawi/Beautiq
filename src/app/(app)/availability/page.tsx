import { requireCurrentBusiness } from "@/server/auth/session";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PLACEHOLDERS } from "@/lib/constants/he";

export default async function AvailabilityPage() {
  await requireCurrentBusiness();
  return (
    <PlaceholderPage
      title={PLACEHOLDERS.availability.title}
      message={PLACEHOLDERS.availability.message}
    />
  );
}
