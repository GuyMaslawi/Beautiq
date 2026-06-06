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
 */
export async function findOrCreateClient(
  tenant: TenantContext,
  { fullName, phone }: { fullName: string; phone: string },
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
    if (!existing.fullName && fullName) {
      return prisma.client.update({
        where: { id: existing.id },
        data: { fullName },
      });
    }
    return existing;
  }

  return prisma.client.create({
    data: {
      businessId: tenant.businessId,
      fullName,
      phone,
      normalizedPhone: normalized,
    },
  });
}
