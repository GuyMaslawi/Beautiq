import { Store, Tag, ShieldCheck, Link2, SlidersHorizontal, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
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

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="bg-surface rounded-2xl border p-6"
      style={{
        borderColor: "var(--border)",
        boxShadow: "0 1px 4px rgba(43,37,48,0.06)",
      }}
    >
      <div className="flex items-center gap-2.5 mb-5">
        {icon && (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
            style={{ background: "rgba(184,107,140,0.10)" }}
          >
            {icon}
          </div>
        )}
        <h2 className="text-foreground text-base font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

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
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        icon={SlidersHorizontal}
        title={SETTINGS.pageTitle}
        subtitle={SETTINGS.pageSubtitle}
      />

      <div className="space-y-6">
        {/* Section 1 — Business details */}
        <SectionCard title={SETTINGS.businessDetails.sectionTitle} icon={<Store className="h-4 w-4" style={{ color: "#b86b8c" }} />}>
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
        </SectionCard>

        {/* Section 2 — Business categories */}
        <SectionCard title={SETTINGS.categories.sectionTitle} icon={<Tag className="h-4 w-4" style={{ color: "#b86b8c" }} />}>
          <BusinessCategoriesForm
            action={updateBusinessCategoriesAction}
            allCategories={allCategories}
            selectedIds={selectedCategoryIds}
          />
        </SectionCard>

        {/* Section 3 — Cancellation policy */}
        <SectionCard title={SETTINGS.cancellationPolicy.sectionTitle} icon={<ShieldCheck className="h-4 w-4" style={{ color: "#b86b8c" }} />}>
          <CancellationPolicyForm
            action={updateCancellationPolicyAction}
            initialValues={policy}
          />
        </SectionCard>

        {/* Section — Payments & clearing */}
        <SectionCard title={PAYMENTS.settings.sectionTitle} icon={<CreditCard className="h-4 w-4" style={{ color: "#b86b8c" }} />}>
          <PaymentsSettingsForm
            action={updatePaymentSettingsAction}
            initialValues={paymentSettings}
            connectionStatus={resolvedPayments.status}
          />
        </SectionCard>

        {/* Section 4 — Public link (informational, coming soon) */}
        <SectionCard title={SETTINGS.publicLink.sectionTitle} icon={<Link2 className="h-4 w-4" style={{ color: "#b86b8c" }} />}>
          <PublicLinkCard slug={settings.slug} />
        </SectionCard>
      </div>
    </div>
  );
}
