import { Store, Tag, ShieldCheck, Link2, SlidersHorizontal, CreditCard } from "lucide-react";
import { PremiumPageShell, BeautyPageHero } from "@/components/premium";
import { Section } from "@/components/ui/section";
import { requireCurrentBusiness } from "@/server/auth/session";
import {
  getBusinessSettings,
  getCancellationPolicy,
  getAllBusinessCategories,
  getSelectedCategoryIds,
} from "@/server/settings/queries";
import {
  updateBusinessDetailsAction,
  updateBusinessCategoriesAction,
  updateCancellationPolicyAction,
} from "@/server/settings/actions";
import { BusinessDetailsForm } from "@/components/settings/business-details-form";
import { BusinessCategoriesForm } from "@/components/settings/business-categories-form";
import { CancellationPolicyForm } from "@/components/settings/cancellation-policy-form";
import { PublicLinkCard } from "@/components/settings/public-link-card";
import { PaymentsSettingsForm } from "@/components/settings/payments-settings-form";
import { getPaymentSettings } from "@/server/payments/settings";
import { resolvePaymentProviderForBusiness } from "@/server/payments/resolver";
import { updatePaymentSettingsAction } from "@/server/payments/actions";
import { SETTINGS, PAYMENTS } from "@/lib/constants/he";

export default async function SettingsPage() {
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };

  const [
    settings,
    policy,
    allCategories,
    selectedCategoryIds,
    paymentSettings,
    resolvedPayments,
  ] = await Promise.all([
    getBusinessSettings(tenant),
    getCancellationPolicy(tenant),
    getAllBusinessCategories(),
    getSelectedCategoryIds(tenant),
    getPaymentSettings(business.id),
    resolvePaymentProviderForBusiness(business.id),
  ]);

  if (!settings) return null;

  return (
    <PremiumPageShell tint="champagne" width="default">
      <BeautyPageHero
        icon={SlidersHorizontal}
        eyebrow="הגדרות העסק"
        title={SETTINGS.pageTitle}
        subtitle={SETTINGS.pageSubtitle}
        tint="champagne"
      />

      <div className="space-y-6">
        {/* Section 1 — Business details */}
        <Section title={SETTINGS.businessDetails.sectionTitle} icon={<Store className="h-4 w-4" style={{ color: "#b86b8c" }} />}>
          <BusinessDetailsForm
            action={updateBusinessDetailsAction}
            initialValues={{
              name: settings.name,
              phone: settings.phone,
              city: settings.city,
              description: settings.description,
              addressNote: settings.addressNote,
            }}
          />
        </Section>

        {/* Section 2 — Business categories */}
        <Section title={SETTINGS.categories.sectionTitle} icon={<Tag className="h-4 w-4" style={{ color: "#b86b8c" }} />}>
          <BusinessCategoriesForm
            action={updateBusinessCategoriesAction}
            allCategories={allCategories}
            selectedIds={selectedCategoryIds}
          />
        </Section>

        {/* Section 3 — Cancellation policy */}
        <Section title={SETTINGS.cancellationPolicy.sectionTitle} icon={<ShieldCheck className="h-4 w-4" style={{ color: "#b86b8c" }} />}>
          <CancellationPolicyForm
            action={updateCancellationPolicyAction}
            initialValues={policy}
          />
        </Section>

        {/* Section — Payments & clearing */}
        <Section title={PAYMENTS.settings.sectionTitle} icon={<CreditCard className="h-4 w-4" style={{ color: "#b86b8c" }} />}>
          <PaymentsSettingsForm
            action={updatePaymentSettingsAction}
            initialValues={paymentSettings}
            connectionStatus={resolvedPayments.status}
          />
        </Section>

        {/* Section 4 — Public link (informational, coming soon) */}
        <Section title={SETTINGS.publicLink.sectionTitle} icon={<Link2 className="h-4 w-4" style={{ color: "#b86b8c" }} />}>
          <PublicLinkCard slug={settings.slug} />
        </Section>
      </div>
    </PremiumPageShell>
  );
}
