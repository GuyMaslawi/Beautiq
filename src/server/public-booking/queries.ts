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

export interface PublicBusiness {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  area: string | null;
  slug: string;
  services: PublicService[];
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
      slug: true,
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
    },
  });

  if (!business) return null;

  return {
    id: business.id,
    name: business.name,
    description: business.description,
    city: business.city,
    area: business.area,
    slug: business.slug,
    services: business.services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMinutes: s.durationMinutes,
      price: s.price.toString(),
      requiresDeposit: s.requiresDeposit,
      depositAmount: s.depositAmount ? s.depositAmount.toString() : null,
    })),
  };
}
