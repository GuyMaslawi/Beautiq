/**
 * Customer payment-status page (shown after returning from the provider).
 *
 *   /pay/status?bp=<bookingPaymentId>
 *
 * The status shown here is read from the DB — the authoritative source updated
 * by the verified provider webhook — NOT from the return URL the customer
 * arrived on. RTL, Hebrew, mobile-first.
 */

import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { PAYMENTS } from "@/lib/constants/he";

type View = "success" | "failure" | "pending";

export default async function PaymentStatusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const bp = typeof sp.bp === "string" ? sp.bp : "";

  const payment = bp
    ? await prisma.bookingPayment.findUnique({
        where: { id: bp },
        select: { status: true, business: { select: { slug: true, name: true } } },
      })
    : null;

  let view: View = "pending";
  if (payment) {
    if (payment.status === "paid") view = "success";
    else if (["failed", "cancelled", "expired"].includes(payment.status))
      view = "failure";
    else view = "pending";
  } else if (sp.failed === "1") {
    view = "failure";
  }

  const copy =
    view === "success"
      ? PAYMENTS.returnStatus
      : view === "failure"
        ? PAYMENTS.returnStatus
        : PAYMENTS.returnStatus;

  const title =
    view === "success"
      ? copy.successTitle
      : view === "failure"
        ? copy.failureTitle
        : copy.pendingTitle;
  const body =
    view === "success"
      ? copy.successBody
      : view === "failure"
        ? copy.failureBody
        : copy.pendingBody;
  const emoji = view === "success" ? "✅" : view === "failure" ? "⚠️" : "⏳";
  const slug = payment?.business.slug;

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6"
      dir="rtl"
    >
      <div className="w-full max-w-sm space-y-6 rounded-3xl border border-[var(--border)] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--background)] text-4xl">
          {emoji}
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-[var(--foreground)]">{title}</h1>
          <p className="text-sm leading-relaxed text-[var(--muted)]">{body}</p>
        </div>
        {slug && (
          <Link
            href={`/b/${slug}`}
            className="inline-flex w-full items-center justify-center rounded-2xl border-2 border-[var(--primary)] py-3 text-sm font-bold text-[var(--primary)] transition-all hover:opacity-90"
          >
            {copy.backToBusiness}
          </Link>
        )}
      </div>
    </main>
  );
}
