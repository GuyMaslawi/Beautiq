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
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";
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
  const StatusIcon =
    view === "success" ? CheckCircle2 : view === "failure" ? AlertTriangle : Clock;
  const iconStyles =
    view === "success"
      ? { background: "rgba(61,139,110,0.12)", color: "#3d8b6e" }
      : view === "failure"
        ? { background: "rgba(217,119,6,0.12)", color: "#b45309" }
        : {
            background: "var(--brand-gradient-soft)",
            color: "var(--primary)",
          };
  const slug = payment?.business.slug;

  return (
    <main
      className="app-ambient flex min-h-screen items-center justify-center p-6"
      dir="rtl"
    >
      <div className="aura-card w-full max-w-sm space-y-6 rounded-[1.75rem] p-8 text-center">
        <div
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
          style={iconStyles}
        >
          <StatusIcon className="h-9 w-9" strokeWidth={1.8} />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-xl font-semibold tracking-tight text-[var(--foreground)]">
            {title}
          </h1>
          <p className="text-sm leading-relaxed text-[var(--muted)]">{body}</p>
        </div>
        {slug && (
          <Link
            href={`/b/${slug}`}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl border-2 border-[var(--primary)] bg-white py-3 text-sm font-bold text-[var(--primary)] transition-all hover:bg-[var(--primary)] hover:text-white"
          >
            {copy.backToBusiness}
          </Link>
        )}
      </div>
    </main>
  );
}
