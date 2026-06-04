import { requireCurrentBusiness } from "@/server/auth/session";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PLACEHOLDERS } from "@/lib/constants/he";

export default async function BookingsPage() {
  // Needs a business; without one, back to the dashboard setup card.
  await requireCurrentBusiness();
  return (
    <PlaceholderPage
      title={PLACEHOLDERS.bookings.title}
      message={PLACEHOLDERS.bookings.message}
    />
  );
}
