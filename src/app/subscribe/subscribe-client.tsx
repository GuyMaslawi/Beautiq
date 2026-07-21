"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Sparkles,
  Crown,
  Check,
  ShieldCheck,
  Gem,
  Flower2,
  Star,
} from "lucide-react";
import { activateSubscriptionAction } from "@/server/subscription/actions";
import { PREMIUM_PLAN, PLATINUM_PLAN, PLANS, type PlanId, type PlanInfo } from "@/lib/plans";
import { MockPaymentForm } from "@/components/plans/mock-payment-form";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── Ambient dark-luxury background ─────────────────────────────────────── */
function Ambient() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div style={{ position: "absolute", top: "-160px", right: "-120px", width: 620, height: 620, borderRadius: "50%", filter: "blur(70px)", background: "radial-gradient(circle,rgba(199,111,147,.24) 0%,transparent 70%)" }} />
      <div style={{ position: "absolute", bottom: "-140px", left: "-120px", width: 520, height: 520, borderRadius: "50%", filter: "blur(70px)", background: "radial-gradient(circle,rgba(212,168,83,.16) 0%,transparent 70%)" }} />
      <div style={{ position: "absolute", top: "40%", left: "12%", width: 320, height: 320, borderRadius: "50%", filter: "blur(80px)", background: "radial-gradient(circle,rgba(146,96,159,.16) 0%,transparent 70%)" }} />
    </div>
  );
}

/* ── Plan card ──────────────────────────────────────────────────────────── */
function PlanCard({ plan, featured, onSelect }: { plan: PlanInfo; featured: boolean; onSelect: () => void }) {
  if (featured) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
        className="relative flex flex-col rounded-[1.75rem] p-6"
        style={{
          background: "linear-gradient(160deg, #2e0d20 0%, #4c1535 48%, #3a0e27 100%)",
          border: "1.5px solid rgba(212,168,83,0.40)",
          boxShadow: "0 24px 70px rgba(46,13,32,0.55), 0 0 0 1px rgba(212,168,83,0.10), 0 0 60px rgba(199,111,147,0.12)",
        }}
      >
        {/* Ambient glow clipped to the card so the badge above can overflow freely */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.75rem]">
          <div className="absolute -top-16 -left-16 h-56 w-56 rounded-full opacity-30" style={{ background: "radial-gradient(circle, rgba(212,168,83,0.55) 0%, transparent 70%)" }} />
        </div>

        <div className="absolute -top-3 right-6 z-10 flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold" style={{ background: "linear-gradient(135deg, #e5bd6a 0%, #c09560 100%)", color: "#3a2200", boxShadow: "0 4px 16px rgba(212,168,83,0.50)" }}>
          <Star className="h-3 w-3" style={{ fill: "#3a2200" }} />
          הכי משתלם
        </div>

        <div className="relative">
          <div className="mb-1 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(212,168,83,0.18)", border: "1px solid rgba(212,168,83,0.38)" }}>
              <Gem className="h-4 w-4" style={{ color: "#e5bd6a" }} />
            </span>
            <h3 className="font-display text-xl font-semibold text-white">{plan.name}</h3>
          </div>
          <p className="mb-3 text-[13px] leading-5" style={{ color: "rgba(255,255,255,0.62)" }}>{plan.tagline}</p>

          <div className="mb-3 flex items-baseline gap-1.5">
            <span className="font-display text-4xl font-bold tabular-nums" style={{ color: "#e5bd6a" }}>₪{plan.price}</span>
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.50)" }}>/ לחודש</span>
          </div>

          <button
            onClick={onSelect}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-transform duration-200 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #e5bd6a 0%, #c09560 100%)", color: "#3a2200", boxShadow: "0 8px 24px rgba(212,168,83,0.45)" }}
          >
            <Crown className="h-4 w-4" />
            בחירת פלטינום
          </button>

          {plan.featuresIntro && (
            <p className="mb-2 text-xs font-semibold" style={{ color: "rgba(229,189,106,0.85)" }}>{plan.featuresIntro}</p>
          )}
          <ul className="flex flex-col gap-1.5">
            {plan.features.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(212,168,83,0.18)", border: "1px solid rgba(212,168,83,0.35)" }}>
                  <Check className="h-2.5 w-2.5" style={{ color: "#e5bd6a" }} />
                </span>
                <span className="text-[13px] leading-4" style={{ color: "rgba(255,255,255,0.88)" }}>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.05, ease: EASE }}
      className="relative flex flex-col rounded-[1.75rem] p-6"
      style={{ background: "rgba(255,255,255,0.97)", border: "1.5px solid rgba(172,92,127,0.22)", boxShadow: "0 20px 50px rgba(43,13,32,0.28)" }}
    >
      <div className="mb-1 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(172,92,127,0.12)", border: "1px solid rgba(172,92,127,0.22)" }}>
          <Flower2 className="h-4 w-4" style={{ color: "var(--primary)" }} />
        </span>
        <h3 className="font-display text-xl font-semibold" style={{ color: "var(--foreground)" }}>{plan.name}</h3>
      </div>
      <p className="mb-3 text-[13px] leading-5" style={{ color: "var(--muted)" }}>{plan.tagline}</p>

      <div className="mb-3 flex items-baseline gap-1.5">
        <span className="font-display text-4xl font-bold tabular-nums" style={{ color: "var(--primary)" }}>₪{plan.price}</span>
        <span className="text-sm" style={{ color: "var(--muted)" }}>/ לחודש</span>
      </div>

      <button
        onClick={onSelect}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-transform duration-200 hover:-translate-y-0.5"
        style={{ background: "rgba(172,92,127,0.10)", border: "1.5px solid rgba(172,92,127,0.30)", color: "var(--primary)" }}
      >
        בחירת פרימיום
      </button>

      <ul className="flex flex-col gap-1.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(172,92,127,0.12)", border: "1px solid rgba(172,92,127,0.22)" }}>
              <Check className="h-2.5 w-2.5" style={{ color: "var(--primary)" }} />
            </span>
            <span className="text-[13px] leading-4" style={{ color: "var(--foreground)" }}>{f}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

/* ── Plan selection step ────────────────────────────────────────────────── */
function PlanSelection({ userName, onSelect }: { userName: string | null; onSelect: (id: PlanId) => void }) {
  return (
    <div className="relative mx-auto w-full max-w-5xl px-5 py-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: EASE }} className="mb-6 text-center">
        <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full px-4 py-1" style={{ background: "rgba(199,111,147,0.12)", border: "1px solid rgba(199,111,147,0.26)" }}>
          <Sparkles className="h-3.5 w-3.5" style={{ color: "#e7a9c4" }} />
          <span className="text-xs font-semibold tracking-wide" style={{ color: "#e7a9c4" }}>עוד צעד אחד — ואת בפנים</span>
        </div>
        <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl md:text-4xl">
          {userName ? `${userName}, ` : ""}בחרי את התוכנית שלך
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6" style={{ color: "rgba(255,255,255,0.60)" }}>
          כל התוכניות כוללות ניהול מלא של העסק בעברית. אפשר לשדרג או לבטל בכל רגע — ללא התחייבות.
        </p>
      </motion.div>

      <div className="grid gap-5 md:grid-cols-2 md:items-start">
        <PlanCard plan={PREMIUM_PLAN} featured={false} onSelect={() => onSelect("premium")} />
        <PlanCard plan={PLATINUM_PLAN} featured onSelect={() => onSelect("platinum")} />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.4 }} className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {[
          { icon: ShieldCheck, text: "תשלום מאובטח" },
          { icon: Check, text: "ביטול בכל רגע" },
          { icon: Sparkles, text: "ללא התחייבות" },
          { icon: Flower2, text: "תמיכה בעברית" },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5" style={{ color: "rgba(229,189,106,0.75)" }} />
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>{text}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/* ── Root ───────────────────────────────────────────────────────────────── */
export function SubscribeClient({ userName }: { userName: string | null }) {
  const [selected, setSelected] = useState<PlanId | null>(null);

  return (
    <div dir="rtl" className="relative flex min-h-screen flex-col items-center justify-center" style={{ background: "linear-gradient(155deg, #130a19 0%, #231131 35%, #3c1f3a 65%, #1b0f22 100%)" }}>
      <Ambient />

      <div className="relative flex w-full items-center justify-center pt-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-base font-bold text-white" style={{ background: "linear-gradient(135deg,#c76f93,#ac5c7f)", boxShadow: "0 2px 12px rgba(172,92,127,0.55)" }}>A</span>
          <span className="text-lg font-bold tracking-tight text-white">Allura</span>
        </div>
      </div>

      <div className="relative flex w-full flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          {selected === null ? (
            <motion.div key="plans" exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }} className="w-full">
              <PlanSelection userName={userName} onSelect={setSelected} />
            </motion.div>
          ) : (
            <motion.div key="checkout" className="w-full">
              <MockPaymentForm
                plan={PLANS[selected]}
                action={activateSubscriptionAction}
                redirectTo="/dashboard"
                onBack={() => setSelected(null)}
                backLabel="חזרה לבחירת תוכנית"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
