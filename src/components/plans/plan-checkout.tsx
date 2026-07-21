"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  Loader2,
  Gem,
  Flower2,
  Check,
  CreditCard,
} from "lucide-react";
import { startSubscriptionCheckoutAction } from "@/server/subscription/actions";
import type { PlanInfo } from "@/lib/plans";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Subscription checkout summary. Allura never collects card details itself — the
 * owner pays on Grow's (Meshulam) secure hosted page. This shows the order
 * summary and a single CTA that opens the checkout: it calls the server action,
 * then redirects to Grow's hosted page (or, when Grow is not configured in dev,
 * straight into the app). Shared by the signup paywall and the upgrade flow.
 */
export function PlanCheckout({
  plan,
  submitLabel,
  onBack,
  backLabel = "חזרה",
}: {
  plan: PlanInfo;
  submitLabel?: string;
  onBack?: () => void;
  backLabel?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    setError(null);
    startTransition(async () => {
      const result = await startSubscriptionCheckoutAction(plan.id);
      if (!result.ok || !result.redirectUrl) {
        setError(result.error ?? "אירעה תקלה. נסי שוב.");
        return;
      }
      if (/^https?:\/\//i.test(result.redirectUrl)) {
        // External (Grow) hosted payment page.
        window.location.href = result.redirectUrl;
      } else {
        router.replace(result.redirectUrl);
        router.refresh();
      }
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="relative mx-auto w-full max-w-4xl px-5 py-12 sm:py-16"
    >
      {onBack && (
        <button
          onClick={onBack}
          disabled={isPending}
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ color: "rgba(255,255,255,0.65)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>
      )}

      <div className="grid gap-6 md:grid-cols-[1fr_1.1fr] md:items-start">
        {/* Order summary */}
        <div
          className="order-2 flex flex-col rounded-[1.75rem] p-7 md:order-1"
          style={{
            background: "linear-gradient(160deg, #2e0d20 0%, #4c1535 55%, #3a0e27 100%)",
            border: "1px solid rgba(212,168,83,0.30)",
            boxShadow: "0 20px 50px rgba(46,13,32,0.45)",
          }}
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "rgba(229,189,106,0.75)" }}>
            סיכום הזמנה
          </p>
          <div className="mb-5 flex items-center gap-2.5">
            {plan.id === "platinum" ? (
              <Gem className="h-6 w-6" style={{ color: "#e5bd6a" }} />
            ) : (
              <Flower2 className="h-6 w-6" style={{ color: "#e7a9c4" }} />
            )}
            <h2 className="font-display text-2xl font-semibold text-white">תוכנית {plan.name}</h2>
          </div>

          <div
            className="mb-5 flex items-baseline justify-between border-b pb-5"
            style={{ borderColor: "rgba(255,255,255,0.10)" }}
          >
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.60)" }}>חיוב חודשי</span>
            <span className="font-display text-4xl font-bold tabular-nums" style={{ color: "#e5bd6a" }}>
              ₪{plan.price}
            </span>
          </div>

          {plan.featuresIntro && (
            <p className="mb-2.5 text-xs font-semibold" style={{ color: "rgba(229,189,106,0.85)" }}>
              {plan.featuresIntro}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {plan.features.slice(0, 6).map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "#e5bd6a" }} />
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.78)" }}>{f}</span>
              </li>
            ))}
          </ul>

          <div
            className="mt-6 flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: "rgba(229,189,106,0.8)" }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
              ניתן לבטל בכל רגע מהגדרות העסק, ללא עמלות ביטול.
            </span>
          </div>
        </div>

        {/* Secure checkout panel */}
        <div
          className="order-1 flex flex-col rounded-[1.75rem] p-7 md:order-2"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.30)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5" style={{ color: "#e7a9c4" }} />
            <h3 className="text-lg font-bold text-white">תשלום מאובטח</h3>
          </div>

          <p className="mb-6 text-sm leading-6" style={{ color: "rgba(255,255,255,0.65)" }}>
            התשלום מתבצע בעמוד סליקה מאובטח של Grow. פרטי הכרטיס שלך נשמרים אצל חברת
            הסליקה בלבד — Allura לעולם לא רואה או שומרת את מספר הכרטיס. החיוב מתחדש
            אוטומטית מדי חודש, וניתן לבטל בכל רגע.
          </p>

          <div className="mb-6 flex flex-col gap-2.5">
            {[
              "מעבר לעמוד סליקה מאובטח (SSL)",
              "חיוב חודשי מתחדש — הוראת קבע",
              "ביטול בכל רגע, ללא התחייבות",
            ].map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "rgba(212,168,83,0.18)", border: "1px solid rgba(212,168,83,0.35)" }}
                >
                  <Check className="h-2.5 w-2.5" style={{ color: "#e5bd6a" }} />
                </span>
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.80)" }}>{t}</span>
              </div>
            ))}
          </div>

          {error && (
            <p
              className="mb-4 rounded-xl px-3 py-2.5 text-sm"
              style={{ background: "rgba(190,74,74,0.15)", border: "1px solid rgba(190,74,74,0.35)", color: "#f0b4b4" }}
            >
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleContinue}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-bold transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
            style={{
              background: "linear-gradient(135deg, #e5bd6a 0%, #c09560 100%)",
              color: "#3a2200",
              boxShadow: "0 8px 24px rgba(212,168,83,0.40)",
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                מעבר לתשלום…
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                {submitLabel ?? `המשך לתשלום מאובטח — ₪${plan.price}/חודש`}
              </>
            )}
          </button>

          <p className="mt-3.5 flex items-center justify-center gap-1.5 text-center text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>
            <Lock className="h-3 w-3" />
            הסליקה מאובטחת ומבוצעת על ידי Grow (משולם)
          </p>
        </div>
      </div>
    </motion.div>
  );
}
