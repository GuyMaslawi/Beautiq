import { prisma } from "@/server/db/prisma";

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string;
  requiresDeposit: boolean;
  depositAmount: string | null;
}

export interface PublicCancellationPolicy {
  enabled: boolean;
  policyText: string | null;
  lateCancellationHours: number | null;
  lateCancellationFeeType: string;
  lateCancellationFeeAmount: string | null;
  lateCancellationFeePercentage: string | null;
}

export interface PublicGalleryImage {
  id: string;
  imageUrl: string;
  caption: string | null;
}

export interface PublicReview {
  id: string;
  clientName: string;
  reviewText: string;
  rating: number;
}

export interface PublicAvailabilityDay {
  weekday: number;
  windows: { startMinutes: number; endMinutes: number }[];
}

export interface PublicBusiness {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  area: string | null;
  addressNote: string | null;
  phone: string | null;
  instagramUrl: string | null;
  introMessage: string | null;
  slug: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  showServices: boolean;
  showPrices: boolean;
  showHours: boolean;
  showReviews: boolean;
  showGallery: boolean;
  showCancellationPolicy: boolean;
  showPhone: boolean;
  showAddress: boolean;
  services: PublicService[];
  cancellationPolicy: PublicCancellationPolicy | null;
  galleryImages: PublicGalleryImage[];
  reviews: PublicReview[];
  availabilityDays: PublicAvailabilityDay[];
}

export async function getPublicBusiness(
  slug: string,
): Promise<PublicBusiness | null> {
  const business = await prisma.business.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      description: true,
      city: true,
      area: true,
      addressNote: true,
      phone: true,
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
      services: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          description: true,
          durationMinutes: true,
          price: true,
          requiresDeposit: true,
          depositAmount: true,
        },
        orderBy: { name: "asc" },
      },
      cancellationPolicy: {
        select: {
          enabled: true,
          policyText: true,
          lateCancellationHours: true,
          lateCancellationFeeType: true,
          lateCancellationFeeAmount: true,
          lateCancellationFeePercentage: true,
        },
      },
      galleryImages: {
        select: { id: true, imageUrl: true, caption: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      clientReviews: {
        where: { isApproved: true },
        select: { id: true, clientName: true, reviewText: true, rating: true },
        orderBy: { createdAt: "desc" },
      },
      availabilityRules: {
        where: { isActive: true },
        select: { weekday: true, startMinutes: true, endMinutes: true },
        orderBy: [{ weekday: "asc" }, { startMinutes: "asc" }],
      },
    },
  });

  if (!business) return null;

  const cp = business.cancellationPolicy;
  const cancellationPolicy: PublicCancellationPolicy | null =
    cp && cp.enabled
      ? {
          enabled: cp.enabled,
          policyText: cp.policyText,
          lateCancellationHours: cp.lateCancellationHours,
          lateCancellationFeeType: cp.lateCancellationFeeType,
          lateCancellationFeeAmount: cp.lateCancellationFeeAmount?.toString() ?? null,
          lateCancellationFeePercentage: cp.lateCancellationFeePercentage?.toString() ?? null,
        }
      : null;

  return {
    id: business.id,
    name: business.name,
    description: business.description,
    city: business.city,
    area: business.area,
    addressNote: business.addressNote,
    phone: business.phone,
    instagramUrl: business.instagramUrl,
    introMessage: business.introMessage,
    slug: business.slug,
    logoUrl: business.logoUrl,
    coverImageUrl: business.coverImageUrl,
    showServices: business.showServices,
    showPrices: business.showPrices,
    showHours: business.showHours,
    showReviews: business.showReviews,
    showGallery: business.showGallery,
    showCancellationPolicy: business.showCancellationPolicy,
    showPhone: business.showPhone,
    showAddress: business.showAddress,
    services: business.services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMinutes: s.durationMinutes,
      price: s.price.toString(),
      requiresDeposit: s.requiresDeposit,
      depositAmount: s.depositAmount ? s.depositAmount.toString() : null,
    })),
    cancellationPolicy,
    galleryImages: business.galleryImages.map((g) => ({
      id: g.id,
      imageUrl: g.imageUrl,
      caption: g.caption,
    })),
    reviews: business.clientReviews.map((r) => ({
      id: r.id,
      clientName: r.clientName,
      reviewText: r.reviewText,
      rating: r.rating,
    })),
    availabilityDays: buildAvailabilityDays(business.availabilityRules),
  };
}

function buildAvailabilityDays(
  rules: { weekday: number; startMinutes: number; endMinutes: number }[],
): PublicAvailabilityDay[] {
  const map = new Map<number, { startMinutes: number; endMinutes: number }[]>();
  for (const rule of rules) {
    if (!map.has(rule.weekday)) map.set(rule.weekday, []);
    map.get(rule.weekday)!.push({
      startMinutes: rule.startMinutes,
      endMinutes: rule.endMinutes,
    });
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekday, windows]) => ({ weekday, windows }));
}
