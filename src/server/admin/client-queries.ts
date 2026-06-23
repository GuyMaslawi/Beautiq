import { prisma } from "@/server/db/prisma";

export interface AdminClientFilters {
  q?: string;
}

export interface AdminClientListItem {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  businessId: string;
  businessName: string;
  whatsappOptIn: boolean;
  marketingOptIn: boolean;
  unsubscribedAt: Date | null;
  createdAt: Date;
  lastBookingAt: Date | null;
}

export async function getAdminClients(
  filters: AdminClientFilters = {},
): Promise<AdminClientListItem[]> {
  const { q } = filters;

  const clients = await prisma.client.findMany({
    where: q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { normalizedPhone: { contains: q } },
            { business: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : undefined,
    include: {
      business: { select: { id: true, name: true } },
      bookings: {
        where: { status: "completed" },
        orderBy: { startTime: "desc" },
        take: 1,
        select: { startTime: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return clients.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    businessId: c.businessId,
    businessName: c.business.name,
    whatsappOptIn: c.whatsappOptIn,
    marketingOptIn: c.marketingOptIn,
    unsubscribedAt: c.unsubscribedAt,
    createdAt: c.createdAt,
    lastBookingAt: c.bookings[0]?.startTime ?? null,
  }));
}

export async function getAdminClientById(clientId: string) {
  return prisma.client.findUnique({
    where: { id: clientId },
    include: {
      business: { select: { id: true, name: true } },
    },
  });
}

export interface AdminBusinessClientItem {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  whatsappOptIn: boolean;
  marketingOptIn: boolean;
  unsubscribedAt: Date | null;
  totalBookings: number;
  totalSpent: number;
  createdAt: Date;
  lastBookingAt: Date | null;
}

/**
 * All clients of a SINGLE business, optionally filtered by a search term.
 * Always scoped by businessId — an admin viewing one business never sees
 * another tenant's clients (CLAUDE.md §10).
 */
export async function getAdminBusinessClients(
  businessId: string,
  q?: string,
): Promise<AdminBusinessClientItem[]> {
  const term = q?.trim();

  const clients = await prisma.client.findMany({
    where: {
      businessId,
      ...(term
        ? {
            OR: [
              { fullName: { contains: term, mode: "insensitive" } },
              { phone: { contains: term } },
              { normalizedPhone: { contains: term } },
              { email: { contains: term, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      bookings: {
        where: { status: "completed" },
        orderBy: { startTime: "desc" },
        take: 1,
        select: { startTime: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return clients.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    whatsappOptIn: c.whatsappOptIn,
    marketingOptIn: c.marketingOptIn,
    unsubscribedAt: c.unsubscribedAt,
    totalBookings: c.totalBookings,
    totalSpent: Number(c.totalSpent),
    createdAt: c.createdAt,
    lastBookingAt: c.bookings[0]?.startTime ?? null,
  }));
}
