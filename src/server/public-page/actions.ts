"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";
import { PUBLIC_PAGE } from "@/lib/constants/he";

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

  try {
    await prisma.business.update({
      where: { id: tenant.businessId },
      data: {
        name: raw.name,
        description: raw.description || null,
        phone: raw.phone || null,
        addressNote: raw.addressNote || null,
        instagramUrl: raw.instagramUrl || null,
        facebookUrl: raw.facebookUrl || null,
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

  try {
    await prisma.business.update({
      where: { id: tenant.businessId },
      data: {
        logoUrl: raw.logoUrl || null,
        coverImageUrl: raw.coverImageUrl || null,
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

export interface VisibilityFormState {
  formError?: string;
  success?: string;
}

export async function updateVisibilityAction(
  _prev: VisibilityFormState,
  formData: FormData,
): Promise<VisibilityFormState> {
  const tenant = await requireTenant();

  const bool = (key: string) => formData.get(key) === "true";

  try {
    await prisma.business.update({
      where: { id: tenant.businessId },
      data: {
        showServices: bool("showServices"),
        showPrices: bool("showPrices"),
        showHours: bool("showHours"),
        showReviews: bool("showReviews"),
        showGallery: bool("showGallery"),
        showCancellationPolicy: bool("showCancellationPolicy"),
        showPhone: bool("showPhone"),
        showAddress: bool("showAddress"),
      },
    });
  } catch {
    return { formError: PUBLIC_PAGE.errors.generic };
  }

  revalidatePath("/public-page");
  return { success: PUBLIC_PAGE.visibility.success };
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

  try {
    const maxOrder = await prisma.galleryImage.aggregate({
      where: { businessId: tenant.businessId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    await prisma.galleryImage.create({
      data: {
        businessId: tenant.businessId,
        imageUrl,
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
