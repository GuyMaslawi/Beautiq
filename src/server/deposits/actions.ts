"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";
import { DEPOSITS } from "@/lib/constants/he";

export interface DepositActionResult {
  success?: boolean;
  error?: string;
}

// Valid deposit status transitions (manual tracking only)
//   pending  → paid
//   paid     → refunded | pending (correction)
//   refunded → pending  (correction)
//   failed   → pending  (correction)
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["paid"],
  paid: ["refunded", "pending"],
  refunded: ["pending"],
  failed: ["pending"],
};

export async function updateDepositStatusAction(
  bookingId: string,
  newStatus: "pending" | "paid" | "refunded",
): Promise<DepositActionResult> {
  const tenant = await requireTenant();

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, businessId: tenant.businessId },
    select: {
      id: true,
      clientId: true,
      depositStatus: true,
      depositAmountSnapshot: true,
    },
  });

  if (!booking) {
    return { error: DEPOSITS.errors.notFound };
  }

  if (booking.depositStatus === "not_required") {
    return { error: DEPOSITS.errors.notAllowed };
  }

  const allowed = VALID_TRANSITIONS[booking.depositStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    return { error: DEPOSITS.errors.invalidTransition };
  }

  const now = new Date();
  const amount = booking.depositAmountSnapshot ?? 0;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { depositStatus: newStatus },
      });

      // Keep a Payment record for timestamp tracking
      const existing = await tx.payment.findFirst({
        where: { bookingId, businessId: tenant.businessId, type: "deposit" },
        select: { id: true },
      });

      if (newStatus === "paid") {
        const paidData = {
          status: "paid" as const,
          markedPaidAt: now,
          refundedAt: null,
        };
        if (existing) {
          await tx.payment.update({ where: { id: existing.id }, data: paidData });
        } else {
          await tx.payment.create({
            data: {
              businessId: tenant.businessId,
              bookingId,
              clientId: booking.clientId,
              amount,
              type: "deposit",
              method: "manual",
              ...paidData,
            },
          });
        }
      } else if (newStatus === "refunded") {
        const refundedData = { status: "refunded" as const, refundedAt: now };
        if (existing) {
          await tx.payment.update({ where: { id: existing.id }, data: refundedData });
        } else {
          await tx.payment.create({
            data: {
              businessId: tenant.businessId,
              bookingId,
              clientId: booking.clientId,
              amount,
              type: "deposit",
              method: "manual",
              ...refundedData,
            },
          });
        }
      } else if (newStatus === "pending" && existing) {
        await tx.payment.update({
          where: { id: existing.id },
          data: { status: "pending", markedPaidAt: null, refundedAt: null },
        });
      }
    });

    revalidatePath(`/bookings/${bookingId}`);
    revalidatePath("/bookings");
    revalidatePath("/");

    return { success: true };
  } catch {
    return { error: DEPOSITS.errors.generic };
  }
}
