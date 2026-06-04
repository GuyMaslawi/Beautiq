import { requireCurrentBusiness } from "@/server/auth/session";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PLACEHOLDERS } from "@/lib/constants/he";

export default async function ClientsPage() {
  await requireCurrentBusiness();
  return (
    <PlaceholderPage
      title={PLACEHOLDERS.clients.title}
      message={PLACEHOLDERS.clients.message}
    />
  );
}
