import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import { normalizePhone } from "@/lib/phone";

/**
 * Find an existing client by normalizedPhone within the business, or create
 * a new one. Never creates duplicate clients for the same phone in the same
 * business (enforced by the unique constraint on [businessId, normalizedPhone]).
 *
 * Name update rule: if the existing client has a name and the caller provides
 * a different name, we leave the existing name intact to avoid overwriting
 * intentional CRM data. Only update if the existing name is empty.
 *
 * Consent rule: opt-in flags are only ever escalated (false → true), never
 * revoked here. A customer who consents while booking grants consent; an
 * unchecked box never clears a previously-granted opt-in.
 */
export async function findOrCreateClient(
  tenant: TenantContext,
  {
    fullName,
    phone,
    whatsappOptIn,
    marketingOptIn,
    optInSource = "public_booking",
  }: {
    fullName: string;
    phone: string;
    whatsappOptIn?: boolean;
    marketingOptIn?: boolean;
    /** Provenance recorded the first time WhatsApp opt-in is granted. */
    optInSource?: string;
  },
) {
  const normalized = normalizePhone(phone);

  const existing = await prisma.client.findUnique({
    where: {
      businessId_normalizedPhone: {
        businessId: tenant.businessId,
        normalizedPhone: normalized,
      },
    },
  });

  if (existing) {
    const data: {
      fullName?: string;
      whatsappOptIn?: boolean;
      marketingOptIn?: boolean;
      whatsappOptInAt?: Date;
      whatsappOptInSource?: string;
    } = {};
    if (!existing.fullName && fullName) data.fullName = fullName;
    // Escalate consent only — never revoke an existing opt-in.
    if (whatsappOptIn && !existing.whatsappOptIn) {
      data.whatsappOptIn = true;
      // Record provenance the first time consent is granted.
      data.whatsappOptInAt = new Date();
      data.whatsappOptInSource = optInSource;
    }
    if (marketingOptIn && !existing.marketingOptIn) data.marketingOptIn = true;

    if (Object.keys(data).length > 0) {
      return prisma.client.update({ where: { id: existing.id }, data });
    }
    return existing;
  }

  return prisma.client.create({
    data: {
      businessId: tenant.businessId,
      fullName,
      phone,
      normalizedPhone: normalized,
      whatsappOptIn: whatsappOptIn ?? false,
      marketingOptIn: marketingOptIn ?? false,
      whatsappOptInAt: whatsappOptIn ? new Date() : null,
      whatsappOptInSource: whatsappOptIn ? optInSource : null,
    },
  });
}
