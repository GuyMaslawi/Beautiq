"use client";

import { useState } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";

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
      className="app-ambient flex min-h-screen items-center justify-center p-6"
      dir="rtl"
    >
      <div className="aura-card w-full max-w-sm space-y-6 rounded-[1.75rem] p-8 text-center">
        <div className="space-y-3">
          <span className="brand-chip mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
            <CreditCard className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <p className="eyebrow text-[var(--muted)]">
              עמוד תשלום לדוגמה (מצב בדיקה)
            </p>
            <h1 className="font-display text-xl font-semibold tracking-tight text-[var(--foreground)]">
              תשלום ל{businessName}
            </h1>
            <p className="display-num text-3xl font-bold text-[var(--primary)]" dir="ltr">
              {amountLabel}
            </p>
          </div>
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
            className="bg-brand-gradient min-h-[48px] w-full rounded-2xl py-3.5 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[.98] disabled:opacity-50"
            style={{ boxShadow: "var(--brand-shadow)" }}
          >
            {busy === "paid" ? "מעבד…" : "אישור תשלום"}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => simulate("failed")}
            className="min-h-[48px] w-full rounded-2xl border-2 border-[var(--border)] bg-white py-3.5 text-sm font-bold text-[var(--muted)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            {busy === "failed" ? "מעבד…" : "ביטול / כישלון תשלום"}
          </button>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--muted-light)]">
          <ShieldCheck className="h-3.5 w-3.5" />
          הדמיה של עמוד תשלום מאובטח של ספק הסליקה
        </p>
      </div>
    </main>
  );
}
