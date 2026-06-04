import { requireCurrentBusiness } from "@/server/auth/session";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PLACEHOLDERS } from "@/lib/constants/he";

export default async function MessagesPage() {
  await requireCurrentBusiness();
  return (
    <PlaceholderPage
      title={PLACEHOLDERS.messages.title}
      message={PLACEHOLDERS.messages.message}
    />
  );
}
