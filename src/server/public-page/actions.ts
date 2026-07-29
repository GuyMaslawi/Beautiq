"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";
import { PUBLIC_PAGE } from "@/lib/constants/he";
import { validateImageUrl, validateSocialField } from "@/lib/validation/url";
import { TEXT_LIMITS, exceedsLimit, tooLongError } from "@/lib/validation/text";

// ---------------------------------------------------------------------------
// Profile + intro message
// ---------------------------------------------------------------------------

export interface PublicProfileFormState {
  errors?: Partial<Record<string, string>>;
  formError?: string;
  success?: string;
  values?: Record<string, string>;
}

export async function updatePublicProfileAction(
  _prev: PublicProfileFormState,
  formData: FormData,
): Promise<PublicProfileFormState> {
  const tenant = await requireTenant();

  const raw = {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    addressNote: String(formData.get("addressNote") ?? "").trim(),
    instagramUrl: String(formData.get("instagramUrl") ?? "").trim(),
    facebookUrl: String(formData.get("facebookUrl") ?? "").trim(),
    introMessage: String(formData.get("introMessage") ?? "").trim(),
  };

  if (!raw.name) {
    return { errors: { name: "יש למלא שם עסק" }, values: raw };
  }

  // תקרות אורך: כל השדות האלה מרונדרים בעמוד הציבורי ונשמרים בעמודות `text`
  // ללא תקרה משלהן, כך שבלי הבדיקה כאן אפשר לשמור מגה-בייטים בשדה אחד
  // ולהאט או להפיל את העמוד הציבורי של העסק.
  const lengthChecks: Array<[keyof typeof raw, number]> = [
    ["name", TEXT_LIMITS.name],
    ["description", TEXT_LIMITS.paragraph],
    ["addressNote", TEXT_LIMITS.short],
    ["introMessage", TEXT_LIMITS.paragraph],
  ];
  for (const [field, limit] of lengthChecks) {
    if (exceedsLimit(raw[field], limit)) {
      return { errors: { [field]: tooLongError(limit) }, values: raw };
    }
  }

  // Social links land in an <a href> on the public page. A bare handle is fine
  // (the page completes it); anything URL-shaped must be https, so a
  // `javascript:` value is rejected rather than silently prefixed.
  const instagramUrl = raw.instagramUrl ? validateSocialField(raw.instagramUrl) : null;
  if (raw.instagramUrl && !instagramUrl) {
    return { errors: { instagramUrl: "הקישור אינו תקין" }, values: raw };
  }
  const facebookUrl = raw.facebookUrl ? validateSocialField(raw.facebookUrl) : null;
  if (raw.facebookUrl && !facebookUrl) {
    return { errors: { facebookUrl: "הקישור אינו תקין" }, values: raw };
  }

  try {
    await prisma.business.update({
      where: { id: tenant.businessId },
      data: {
        name: raw.name,
        description: raw.description || null,
        phone: raw.phone || null,
        addressNote: raw.addressNote || null,
        instagramUrl,
        facebookUrl,
        introMessage: raw.introMessage || null,
      },
    });
  } catch {
    return { formError: PUBLIC_PAGE.errors.generic, values: raw };
  }

  revalidatePath("/public-page");
  revalidatePath("/settings");
  return { success: PUBLIC_PAGE.profile.success };
}

// ---------------------------------------------------------------------------
// Branding (logo + cover URL)
// ---------------------------------------------------------------------------

export interface BrandingFormState {
  errors?: Partial<Record<string, string>>;
  formError?: string;
  success?: string;
  values?: Record<string, string>;
}

export async function updateBrandingAction(
  _prev: BrandingFormState,
  formData: FormData,
): Promise<BrandingFormState> {
  const tenant = await requireTenant();

  const raw = {
    logoUrl: String(formData.get("logoUrl") ?? "").trim(),
    coverImageUrl: String(formData.get("coverImageUrl") ?? "").trim(),
    brandColor: String(formData.get("brandColor") ?? "").trim(),
  };

  // Validate hex color if provided
  if (raw.brandColor && !/^#[0-9a-fA-F]{6}$/.test(raw.brandColor)) {
    return { errors: { brandColor: "צבע לא תקין" }, values: raw };
  }

  // These URLs are rendered on the public page. brandColor was already
  // regex-validated; the URL fields were stored verbatim, which allowed
  // `javascript:` / oversized `data:` values into columns that feed src/href.
  const logoUrl = raw.logoUrl ? validateImageUrl(raw.logoUrl) : null;
  if (raw.logoUrl && !logoUrl) {
    return { errors: { logoUrl: "כתובת התמונה אינה תקינה (נדרשת כתובת https)" }, values: raw };
  }
  const coverImageUrl = raw.coverImageUrl ? validateImageUrl(raw.coverImageUrl) : null;
  if (raw.coverImageUrl && !coverImageUrl) {
    return {
      errors: { coverImageUrl: "כתובת התמונה אינה תקינה (נדרשת כתובת https)" },
      values: raw,
    };
  }

  try {
    await prisma.business.update({
      where: { id: tenant.businessId },
      data: {
        logoUrl,
        coverImageUrl,
        brandColor: raw.brandColor || null,
      },
    });
  } catch {
    return { formError: PUBLIC_PAGE.errors.generic, values: raw };
  }

  revalidatePath("/public-page");
  return { success: PUBLIC_PAGE.branding.success };
}

// ---------------------------------------------------------------------------
// Section visibility toggles
// ---------------------------------------------------------------------------

const VISIBILITY_FIELDS = [
  "showServices",
  "showPrices",
  "showHours",
  "showReviews",
  "showGallery",
  "showPhone",
  "showAddress",
] as const;

export type VisibilityField = (typeof VISIBILITY_FIELDS)[number];

/**
 * Instant single-toggle save — flipping a visibility switch persists
 * immediately, no separate save button. Returns an error so the client can
 * revert on failure.
 */
export async function setVisibilityFieldAction(
  field: VisibilityField,
  value: boolean,
): Promise<{ error?: string }> {
  const tenant = await requireTenant();

  if (!VISIBILITY_FIELDS.includes(field)) {
    return { error: PUBLIC_PAGE.errors.generic };
  }

  try {
    await prisma.business.update({
      where: { id: tenant.businessId },
      data: { [field]: value },
    });
  } catch {
    return { error: PUBLIC_PAGE.errors.generic };
  }

  revalidatePath("/public-page");
  return {};
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

export interface GalleryFormState {
  errors?: Partial<Record<string, string>>;
  formError?: string;
  success?: string;
}

export async function addGalleryImageAction(
  _prev: GalleryFormState,
  formData: FormData,
): Promise<GalleryFormState> {
  const tenant = await requireTenant();

  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim();

  if (!imageUrl) {
    return { errors: { imageUrl: PUBLIC_PAGE.gallery.errors.urlRequired } };
  }

  // https only, length-capped — the value goes straight into an <img src> on the
  // public page and into a DB column with no size limit of its own.
  const safeImageUrl = validateImageUrl(imageUrl);
  if (!safeImageUrl) {
    return {
      errors: { imageUrl: "כתובת התמונה אינה תקינה (נדרשת כתובת https)" },
    };
  }

  // הכיתוב מרונדר תחת התמונה בעמוד הציבורי ונשמר בעמודת `text` ללא תקרה.
  if (exceedsLimit(caption, TEXT_LIMITS.short)) {
    return { errors: { caption: tooLongError(TEXT_LIMITS.short) } };
  }

  try {
    const maxOrder = await prisma.galleryImage.aggregate({
      where: { businessId: tenant.businessId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    await prisma.galleryImage.create({
      data: {
        businessId: tenant.businessId,
        imageUrl: safeImageUrl,
        caption: caption || null,
        sortOrder,
      },
    });
  } catch {
    return { formError: PUBLIC_PAGE.gallery.errors.generic };
  }

  revalidatePath("/public-page");
  return { success: PUBLIC_PAGE.gallery.addSuccess };
}

export async function deleteGalleryImageAction(
  imageId: string,
): Promise<{ error?: string }> {
  const tenant = await requireTenant();

  try {
    await prisma.galleryImage.deleteMany({
      where: { id: imageId, businessId: tenant.businessId },
    });
  } catch {
    return { error: PUBLIC_PAGE.gallery.errors.generic };
  }

  revalidatePath("/public-page");
  return {};
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function deleteClientReviewAction(
  reviewId: string,
): Promise<{ error?: string }> {
  const tenant = await requireTenant();

  try {
    await prisma.clientReview.deleteMany({
      where: { id: reviewId, businessId: tenant.businessId },
    });
  } catch {
    return { error: PUBLIC_PAGE.reviews.errors.generic };
  }

  revalidatePath("/public-page");
  return {};
}

/**
 * Publish a review that arrived from the public booking page.
 *
 * Public submissions are created with isApproved=false (that endpoint is
 * unauthenticated, so anyone could otherwise write straight to a business's
 * public reputation). Only the owner can publish, and only within her own
 * tenant — the write is scoped by businessId, so a crafted reviewId belonging to
 * another business simply matches nothing.
 */
export async function approveClientReviewAction(
  reviewId: string,
): Promise<{ error?: string }> {
  const tenant = await requireTenant();

  try {
    await prisma.clientReview.updateMany({
      where: { id: reviewId, businessId: tenant.businessId },
      data: { isApproved: true },
    });
  } catch {
    return { error: PUBLIC_PAGE.reviews.errors.generic };
  }

  revalidatePath("/public-page");
  return {};
}
