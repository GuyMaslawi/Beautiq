import { Globe, ImageIcon, Eye, Star, Lock, Link2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireCurrentBusiness } from "@/server/auth/session";
import {
  getPublicPageSettings,
  getGalleryImages,
  getClientReviews,
} from "@/server/public-page/queries";
import {
  updatePublicProfileAction,
  updateBrandingAction,
  updateVisibilityAction,
  addGalleryImageAction,
  deleteGalleryImageAction,
  addClientReviewAction,
  deleteClientReviewAction,
} from "@/server/public-page/actions";
import { PublicProfileForm } from "@/components/public-page/public-profile-form";
import { BrandingForm } from "@/components/public-page/branding-form";
import { VisibilityForm } from "@/components/public-page/visibility-form";
import { GalleryManager } from "@/components/public-page/gallery-manager";
import { ReviewsManager } from "@/components/public-page/reviews-manager";
import { PublicLinkPreview } from "@/components/public-page/public-link-preview";
import { PUBLIC_PAGE } from "@/lib/constants/he";

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
      className="rounded-2xl border bg-white p-6"
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
        <h2 className="text-base font-semibold text-[var(--foreground)]">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

export default async function PublicPageSettingsPage() {
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };

  const [settings, galleryImages, reviews] = await Promise.all([
    getPublicPageSettings(tenant),
    getGalleryImages(tenant),
    getClientReviews(tenant),
  ]);

  if (!settings) return null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6" dir="rtl">
      <PageHeader
        icon={Globe}
        title={PUBLIC_PAGE.pageTitle}
        subtitle={PUBLIC_PAGE.pageSubtitle}
      />

      {/* 1. Preview / link */}
      <SectionCard
        title={PUBLIC_PAGE.preview.sectionTitle}
        icon={<Link2 className="h-4 w-4" style={{ color: "#b86b8c" }} />}
      >
        <PublicLinkPreview slug={settings.slug} />
      </SectionCard>

      {/* 2. Business profile */}
      <SectionCard
        title={PUBLIC_PAGE.profile.sectionTitle}
        icon={<Globe className="h-4 w-4" style={{ color: "#b86b8c" }} />}
      >
        <PublicProfileForm
          action={updatePublicProfileAction}
          initialValues={{
            name: settings.name,
            description: settings.description,
            phone: settings.phone,
            addressNote: settings.addressNote,
            instagramUrl: settings.instagramUrl,
            introMessage: settings.introMessage,
          }}
        />
      </SectionCard>

      {/* 3. Logo + cover */}
      <SectionCard
        title={PUBLIC_PAGE.branding.sectionTitle}
        icon={<ImageIcon className="h-4 w-4" style={{ color: "#b86b8c" }} />}
      >
        <BrandingForm
          action={updateBrandingAction}
          initialValues={{
            logoUrl: settings.logoUrl,
            coverImageUrl: settings.coverImageUrl,
          }}
        />
      </SectionCard>

      {/* 4. Visibility toggles */}
      <SectionCard
        title={PUBLIC_PAGE.visibility.sectionTitle}
        icon={<Eye className="h-4 w-4" style={{ color: "#b86b8c" }} />}
      >
        <VisibilityForm
          action={updateVisibilityAction}
          initialValues={{
            showServices: settings.showServices,
            showPrices: settings.showPrices,
            showHours: settings.showHours,
            showReviews: settings.showReviews,
            showGallery: settings.showGallery,
            showCancellationPolicy: settings.showCancellationPolicy,
            showPhone: settings.showPhone,
            showAddress: settings.showAddress,
          }}
        />
      </SectionCard>

      {/* 5. Gallery */}
      <SectionCard
        title={PUBLIC_PAGE.gallery.sectionTitle}
        icon={<ImageIcon className="h-4 w-4" style={{ color: "#b86b8c" }} />}
      >
        <p className="text-sm text-[var(--muted)] mb-4">
          {PUBLIC_PAGE.gallery.sectionSubtitle}
        </p>
        <GalleryManager
          images={galleryImages}
          addAction={addGalleryImageAction}
          deleteAction={deleteGalleryImageAction}
        />
      </SectionCard>

      {/* 6. Reviews */}
      <SectionCard
        title={PUBLIC_PAGE.reviews.sectionTitle}
        icon={<Star className="h-4 w-4" style={{ color: "#b86b8c" }} />}
      >
        <p className="text-sm text-[var(--muted)] mb-4">
          {PUBLIC_PAGE.reviews.sectionSubtitle}
        </p>
        <ReviewsManager
          reviews={reviews}
          addAction={addClientReviewAction}
          deleteAction={deleteClientReviewAction}
        />
      </SectionCard>

      {/* 7. Treatment history — locked / coming soon */}
      <div
        className="rounded-2xl border p-5 opacity-70"
        style={{
          borderColor: "var(--border)",
          background: "rgba(248,244,246,0.6)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
            style={{ background: "rgba(184,107,140,0.08)" }}
          >
            <Lock className="h-4 w-4" style={{ color: "#b86b8c" }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {PUBLIC_PAGE.treatmentHistory.sectionTitle}
            </p>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {PUBLIC_PAGE.treatmentHistory.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
