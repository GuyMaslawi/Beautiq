import { requireTenant } from "@/server/auth/session";
import { createServiceAction } from "@/server/services/actions";
import { ServiceForm } from "@/components/services/service-form";
import { ServicePageHeader } from "@/components/services/service-page-header";
import { SERVICES } from "@/lib/constants/he";
import { PremiumPageShell } from "@/components/premium/page-shell";

export default async function NewServicePage() {
  await requireTenant();

  return (
    <PremiumPageShell tint="champagne" width="default">
      <ServicePageHeader
        eyebrow="הוספת שירות"
        title={SERVICES.form.createTitle}
        subtitle="הגדירי שם, מחיר ומשך טיפול — אפשר לערוך הכל בהמשך."
      />

      <ServiceForm action={createServiceAction} />
    </PremiumPageShell>
  );
}
