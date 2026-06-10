import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";

export interface PublicPageSettings {
  // Profile
  name: string;
  description: string | null;
  phone: string | null;
  city: string | null;
  area: string | null;
  addressNote: string | null;
  instagramUrl: string | null;
  introMessage: string | null;
  slug: string;
  // Branding
  logoUrl: string | null;
  coverImageUrl: string | null;
  // Visibility
  showServices: boolean;
  showPrices: boolean;
  showHours: boolean;
  showReviews: boolean;
  showGallery: boolean;
  showCancellationPolicy: boolean;
  showPhone: boolean;
  showAddress: boolean;
}

export interface GalleryImageData {
  id: string;
  imageUrl: string;
  caption: string | null;
  sortOrder: number;
}

export interface ClientReviewData {
  id: string;
  clientName: string;
  reviewText: string;
  rating: number;
  isApproved: boolean;
}

export async function getPublicPageSettings(
  tenant: TenantContext,
): Promise<PublicPageSettings | null> {
  return prisma.business.findUnique({
    where: { id: tenant.businessId },
    select: {
      name: true,
      description: true,
      phone: true,
      city: true,
      area: true,
      addressNote: true,
      instagramUrl: true,
      introMessage: true,
      slug: true,
      logoUrl: true,
      coverImageUrl: true,
      showServices: true,
      showPrices: true,
      showHours: true,
      showReviews: true,
      showGallery: true,
      showCancellationPolicy: true,
      showPhone: true,
      showAddress: true,
    },
  });
}

export async function getGalleryImages(
  tenant: TenantContext,
): Promise<GalleryImageData[]> {
  return prisma.galleryImage.findMany({
    where: { businessId: tenant.businessId },
    select: { id: true, imageUrl: true, caption: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getClientReviews(
  tenant: TenantContext,
): Promise<ClientReviewData[]> {
  return prisma.clientReview.findMany({
    where: { businessId: tenant.businessId },
    select: {
      id: true,
      clientName: true,
      reviewText: true,
      rating: true,
      isApproved: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
