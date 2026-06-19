import { Globe, ImageIcon, Eye, Star, Lock, Link2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
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
  deleteClientReviewAction,
} from "@/server/public-page/actions";
import { PublicProfileForm } from "@/components/public-page/public-profile-form";
import { BrandingForm } from "@/components/public-page/branding-form";
import { VisibilityForm } from "@/components/public-page/visibility-form";
import { GalleryManager } from "@/components/public-page/gallery-manager";
import { ReviewsManager } from "@/components/public-page/reviews-manager";
import { PublicLinkPreview } from "@/components/public-page/public-link-preview";
import { PublicPagePreviewPanel } from "@/components/public-page/public-page-preview-panel";
import { PUBLIC_PAGE } from "@/lib/constants/he";

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
      <Section
        title={PUBLIC_PAGE.preview.sectionTitle}
        icon={<Link2 className="h-4 w-4" style={{ color: "#b86b8c" }} />}
      >
        <PublicLinkPreview slug={settings.slug} />
      </Section>

      {/* 1b. Embedded preview */}
      <Section
        title="תצוגה מקדימה"
        icon={<Eye className="h-4 w-4" style={{ color: "#b86b8c" }} />}
      >
        <PublicPagePreviewPanel slug={settings.slug} />
      </Section>

      {/* 2. Business profile */}
      <Section
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
            facebookUrl: settings.facebookUrl,
            introMessage: settings.introMessage,
          }}
        />
      </Section>

      {/* 3. Logo + cover */}
      <Section
        title={PUBLIC_PAGE.branding.sectionTitle}
        icon={<ImageIcon className="h-4 w-4" style={{ color: "#b86b8c" }} />}
      >
        <BrandingForm
          action={updateBrandingAction}
          initialValues={{
            logoUrl: settings.logoUrl,
            coverImageUrl: settings.coverImageUrl,
            brandColor: settings.brandColor,
          }}
        />
      </Section>

      {/* 4. Visibility toggles */}
      <Section
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
      </Section>

      {/* 5. Gallery */}
      <Section
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
      </Section>

      {/* 6. Reviews */}
      <Section
        title={PUBLIC_PAGE.reviews.sectionTitle}
        icon={<Star className="h-4 w-4" style={{ color: "#b86b8c" }} />}
      >
        <ReviewsManager
          reviews={reviews}
          deleteAction={deleteClientReviewAction}
        />
      </Section>

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
