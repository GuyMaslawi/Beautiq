import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import type { MessageTemplateType } from "@prisma/client";

export interface ComposerBookingOption {
  id: string;
  label: string;
  clientName: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  price?: string;
}

export interface ComposerClientOption {
  id: string;
  label: string;
  clientName: string;
}

export async function getSystemTemplates() {
  return prisma.systemMessageTemplate.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Fetch recent bookings and clients for the Smart Composer selectors on the messages page. */
export async function getComposerData(tenant: TenantContext): Promise<{
  bookingOptions: ComposerBookingOption[];
  clientOptions: ComposerClientOption[];
}> {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAhead = new Date(now);
  thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);

  const [bookings, clients] = await Promise.all([
    prisma.booking.findMany({
      where: {
        businessId: tenant.businessId,
        startTime: { gte: sevenDaysAgo, lte: thirtyDaysAhead },
        status: { notIn: ["rescheduled"] },
      },
      include: {
        client: { select: { fullName: true } },
        service: { select: { name: true } },
      },
      orderBy: { startTime: "asc" },
      take: 30,
    }),
    prisma.client.findMany({
      where: { businessId: tenant.businessId },
      orderBy: { lastVisitAt: "desc" },
      take: 50,
      select: { id: true, fullName: true, phone: true },
    }),
  ]);

  const bookingOptions: ComposerBookingOption[] = bookings.map((b) => {
    const date = new Date(b.startTime).toLocaleDateString("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const time = new Date(b.startTime).toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const priceNum = Number(b.priceSnapshot);
    const price = priceNum > 0 ? `₪${priceNum.toLocaleString("he-IL")}` : undefined;

    return {
      id: b.id,
      label: `${b.client.fullName} — ${b.service.name} — ${date}`,
      clientName: b.client.fullName,
      serviceName: b.service.name,
      bookingDate: date,
      bookingTime: time,
      price,
    };
  });

  const clientOptions: ComposerClientOption[] = clients.map((c) => ({
    id: c.id,
    label: c.phone ? `${c.fullName} (${c.phone})` : c.fullName,
    clientName: c.fullName,
  }));

  return { bookingOptions, clientOptions };
}

/**
 * Resolve the effective template body for a given type and business:
 *   1. Business-specific override (MessageTemplate) — if active
 *   2. System default (SystemMessageTemplate) — if active
 *   Returns null only if neither exists.
 */
export async function resolveTemplate(
  tenant: TenantContext,
  type: MessageTemplateType,
): Promise<string | null> {
  const [businessTemplate, systemTemplate] = await Promise.all([
    prisma.messageTemplate.findUnique({
      where: {
        businessId_type: { businessId: tenant.businessId, type },
      },
      select: { body: true, isActive: true },
    }),
    prisma.systemMessageTemplate.findUnique({
      where: { type },
      select: { body: true, isActive: true },
    }),
  ]);

  if (businessTemplate?.isActive) return businessTemplate.body;
  if (systemTemplate?.isActive) return systemTemplate.body;
  return null;
}
