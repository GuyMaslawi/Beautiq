import { Store, Tag, Link2, SlidersHorizontal } from "lucide-react";
import { PremiumPageShell, BeautyPageHero } from "@/components/premium";
import { Section } from "@/components/ui/section";
import { requireCurrentBusiness } from "@/server/auth/session";
import {
  getBusinessSettings,
  getAllBusinessCategories,
  getSelectedCategoryIds,
} from "@/server/settings/queries";
import {
  updateBusinessDetailsAction,
  updateBusinessCategoriesAction,
} from "@/server/settings/actions";
import { BusinessDetailsForm } from "@/components/settings/business-details-form";
import { BusinessCategoriesForm } from "@/components/settings/business-categories-form";
import { PublicLinkCard } from "@/components/settings/public-link-card";
import { SETTINGS } from "@/lib/constants/he";

export default async function SettingsPage() {
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };

  const [settings, allCategories, selectedCategoryIds] = await Promise.all([
    getBusinessSettings(tenant),
    getAllBusinessCategories(),
    getSelectedCategoryIds(tenant),
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
        <Section title={SETTINGS.businessDetails.sectionTitle} icon={<Store className="h-4 w-4" style={{ color: "#ac5c7f" }} />}>
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
        <Section title={SETTINGS.categories.sectionTitle} icon={<Tag className="h-4 w-4" style={{ color: "#ac5c7f" }} />}>
          <BusinessCategoriesForm
            action={updateBusinessCategoriesAction}
            allCategories={allCategories}
            selectedIds={selectedCategoryIds}
          />
        </Section>

        {/* Section 3 — Public link (informational, coming soon) */}
        <Section title={SETTINGS.publicLink.sectionTitle} icon={<Link2 className="h-4 w-4" style={{ color: "#ac5c7f" }} />}>
          <PublicLinkCard slug={settings.slug} />
        </Section>
      </div>
    </PremiumPageShell>
  );
}
