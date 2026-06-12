import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";

export async function getBookingConfirmationSetting(tenant: TenantContext) {
  return prisma.automationSetting.findUnique({
    where: { businessId_type: { businessId: tenant.businessId, type: "booking_confirmation" } },
  });
}
