"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  CreditCard,
  Loader2,
  Gem,
  Flower2,
  Check,
} from "lucide-react";
import type { PlanInfo } from "@/lib/plans";

const EASE = [0.22, 1, 0.36, 1] as const;

function formatCardNumber(v: string) {
  const digits = v.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(v: string) {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/**
 * Mock checkout (V1 has no real payment provider — see CLAUDE.md §13). Renders an
 * order summary + card form and calls `action` on submit; on success it routes
 * to `redirectTo`. Shared by the signup paywall and the Premium→Platinum upgrade.
 */
export function MockPaymentForm({
  plan,
  action,
  redirectTo,
  submitLabel,
  onBack,
  backLabel = "חזרה",
}: {
  plan: PlanInfo;
  action: (planId: string) => Promise<{ ok: boolean; error?: string }>;
  redirectTo: string;
  submitLabel?: string;
  onBack?: () => void;
  backLabel?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [card, setCard] = useState("");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cardValid = card.replace(/\s/g, "").length === 16;
  const expiryValid = /^\d{2}\/\d{2}$/.test(expiry);
  const cvcValid = /^\d{3,4}$/.test(cvc);
  const nameValid = name.trim().length >= 2;
  const formValid = cardValid && expiryValid && cvcValid && nameValid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!formValid) {
      setError("נא למלא את פרטי התשלום במלואם.");
      return;
    }
    startTransition(async () => {
      const result = await action(plan.id);
      if (!result.ok) {
        setError(result.error ?? "אירעה תקלה. נסי שוב.");
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    });
  }

  const fieldStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#fff",
  };

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

        {/* Payment form */}
        <form
          onSubmit={handleSubmit}
          className="order-1 flex flex-col rounded-[1.75rem] p-7 md:order-2"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.30)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div className="mb-5 flex items-center gap-2">
            <CreditCard className="h-5 w-5" style={{ color: "#e7a9c4" }} />
            <h3 className="text-lg font-bold text-white">פרטי תשלום</h3>
          </div>

          <label className="mb-1.5 block text-xs font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>
            מספר כרטיס
          </label>
          <input
            inputMode="numeric"
            dir="ltr"
            placeholder="0000 0000 0000 0000"
            value={card}
            onChange={(e) => setCard(formatCardNumber(e.target.value))}
            className="mb-4 w-full rounded-xl px-4 py-3 text-left text-sm tracking-widest tabular-nums outline-none transition-colors focus:border-[rgba(231,169,196,0.6)]"
            style={fieldStyle}
          />

          <label className="mb-1.5 block text-xs font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>
            שם בעל/ת הכרטיס
          </label>
          <input
            type="text"
            placeholder="השם כפי שמופיע על הכרטיס"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-4 w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors focus:border-[rgba(231,169,196,0.6)]"
            style={fieldStyle}
          />

          <div className="mb-5 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>
                תוקף
              </label>
              <input
                inputMode="numeric"
                dir="ltr"
                placeholder="MM/YY"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                className="w-full rounded-xl px-4 py-3 text-left text-sm tabular-nums outline-none transition-colors focus:border-[rgba(231,169,196,0.6)]"
                style={fieldStyle}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>
                CVC
              </label>
              <input
                inputMode="numeric"
                dir="ltr"
                placeholder="123"
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full rounded-xl px-4 py-3 text-left text-sm tabular-nums outline-none transition-colors focus:border-[rgba(231,169,196,0.6)]"
                style={fieldStyle}
              />
            </div>
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
            type="submit"
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
                מעבד תשלום…
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                {submitLabel ?? `תשלום ₪${plan.price} והתחלה`}
              </>
            )}
          </button>

          <p className="mt-3.5 flex items-center justify-center gap-1.5 text-center text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>
            <Lock className="h-3 w-3" />
            הפרטים שלך מוגנים ומאובטחים
          </p>
        </form>
      </div>
    </motion.div>
  );
}
