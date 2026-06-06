import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";

export interface DepositPaymentInfo {
  id: string;
  amount: number;
  status: string;
  markedPaidAt: Date | null;
  refundedAt: Date | null;
}

export async function getBookingDepositPayment(
  tenant: TenantContext,
  bookingId: string,
): Promise<DepositPaymentInfo | null> {
  const payment = await prisma.payment.findFirst({
    where: { bookingId, businessId: tenant.businessId, type: "deposit" },
    select: {
      id: true,
      amount: true,
      status: true,
      markedPaidAt: true,
      refundedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!payment) return null;

  return {
    id: payment.id,
    amount: Number(payment.amount),
    status: payment.status,
    markedPaidAt: payment.markedPaidAt,
    refundedAt: payment.refundedAt,
  };
}
