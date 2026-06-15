/**
 * Mock hosted-checkout page (dev/test only).
 *
 *   /pay/mock/[id]?txn=<providerTransactionId>
 *
 * Simulates the provider's secure payment page so the whole flow can be
 * exercised end to end without any external service: the buttons fire the same
 * webhook a real provider would, then return the customer via the standard
 * return URLs. Never handles real card data.
 */

import { notFound } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { formatMinorILS } from "@/lib/payments/money";
import { MockCheckout } from "./mock-checkout";

export default async function MockCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const txn = typeof sp.txn === "string" ? sp.txn : "";

  const payment = await prisma.bookingPayment.findUnique({
    where: { id },
    select: {
      amountMinor: true,
      provider: true,
      business: { select: { name: true } },
    },
  });

  if (!payment) notFound();

  return (
    <MockCheckout
      bookingPaymentId={id}
      txn={txn}
      amountLabel={formatMinorILS(payment.amountMinor)}
      businessName={payment.business.name}
    />
  );
}
