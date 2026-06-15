"use client";

import { useState } from "react";

/**
 * Dev-only mock checkout UI. Fires the mock webhook (server truth), then sends
 * the customer to the standard return URL — exactly mirroring a real hosted
 * provider page.
 */
export function MockCheckout({
  bookingPaymentId,
  txn,
  amountLabel,
  businessName,
}: {
  bookingPaymentId: string;
  txn: string;
  amountLabel: string;
  businessName: string;
}) {
  const [busy, setBusy] = useState<"paid" | "failed" | null>(null);

  async function simulate(outcome: "paid" | "failed") {
    setBusy(outcome);
    try {
      await fetch("/api/payments/mock/webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txn, status: outcome }),
      });
    } catch {
      // ignore — the return page reads authoritative status from the DB
    }
    const target =
      outcome === "paid"
        ? `/api/payments/return/success?bp=${encodeURIComponent(bookingPaymentId)}`
        : `/api/payments/return/failure?bp=${encodeURIComponent(bookingPaymentId)}`;
    window.location.href = target;
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6"
      dir="rtl"
    >
      <div className="w-full max-w-sm space-y-6 rounded-3xl border border-[var(--border)] bg-white p-8 text-center shadow-sm">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            עמוד תשלום לדוגמה (מצב בדיקה)
          </p>
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            תשלום ל{businessName}
          </h1>
          <p className="text-3xl font-bold text-[var(--primary)]">{amountLabel}</p>
        </div>

        <p className="text-xs leading-relaxed text-[var(--muted)]">
          זהו עמוד תשלום מדומה לפיתוח בלבד. לא מתבצעת סליקה אמיתית ולא נשמרים פרטי
          אשראי.
        </p>

        <div className="space-y-3">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => simulate("paid")}
            className="w-full rounded-2xl bg-[var(--primary)] py-3.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
          >
            {busy === "paid" ? "מעבד…" : "אישור תשלום"}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => simulate("failed")}
            className="w-full rounded-2xl border-2 border-[var(--border)] py-3.5 text-sm font-bold text-[var(--muted)] transition-all hover:opacity-90 disabled:opacity-50"
          >
            {busy === "failed" ? "מעבד…" : "ביטול / כישלון תשלום"}
          </button>
        </div>
      </div>
    </main>
  );
}
