import { Store, Tag, Link2, SlidersHorizontal, CreditCard, Bell } from "lucide-react";
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
  setEmailNotificationsAction,
} from "@/server/settings/actions";
import { getSubscriptionOverview } from "@/server/subscription/queries";
import { BusinessDetailsForm } from "@/components/settings/business-details-form";
import { BusinessCategoriesForm } from "@/components/settings/business-categories-form";
import { PublicLinkCard } from "@/components/settings/public-link-card";
import { NotificationsForm } from "@/components/settings/notifications-form";
import { SubscriptionCard } from "@/components/settings/subscription-card";
import { SETTINGS, SUBSCRIPTION } from "@/lib/constants/he";

export default async function SettingsPage() {
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };

  const [settings, allCategories, selectedCategoryIds, subscription] = await Promise.all([
    getBusinessSettings(tenant),
    getAllBusinessCategories(),
    getSelectedCategoryIds(tenant),
    getSubscriptionOverview(),
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

        {/* Section 4 — Notification preferences */}
        <Section title={SETTINGS.notifications.sectionTitle} icon={<Bell className="h-4 w-4" style={{ color: "#ac5c7f" }} />}>
          <NotificationsForm
            action={setEmailNotificationsAction}
            initialEnabled={settings.emailNotificationsEnabled}
          />
        </Section>

        {/* Section 5 — Allura subscription */}
        <Section title={SUBSCRIPTION.sectionTitle} icon={<CreditCard className="h-4 w-4" style={{ color: "#ac5c7f" }} />}>
          <SubscriptionCard overview={subscription} />
        </Section>
      </div>
    </PremiumPageShell>
  );
}
