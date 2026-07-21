"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Crown, Sparkles, ArrowLeft } from "lucide-react";
import { PLATINUM_PLAN } from "@/lib/plans";
import { PlanCheckout } from "@/components/plans/plan-checkout";

const EASE = [0.22, 1, 0.36, 1] as const;

function Ambient() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div style={{ position: "absolute", top: "-160px", right: "-120px", width: 620, height: 620, borderRadius: "50%", filter: "blur(70px)", background: "radial-gradient(circle,rgba(212,168,83,.20) 0%,transparent 70%)" }} />
      <div style={{ position: "absolute", bottom: "-140px", left: "-120px", width: 520, height: 520, borderRadius: "50%", filter: "blur(70px)", background: "radial-gradient(circle,rgba(199,111,147,.16) 0%,transparent 70%)" }} />
    </div>
  );
}

export function UpgradeClient() {
  const router = useRouter();

  return (
    <div dir="rtl" className="relative flex min-h-screen flex-col items-center" style={{ background: "linear-gradient(155deg, #130a19 0%, #231131 35%, #3c1f3a 65%, #1b0f22 100%)" }}>
      <Ambient />

      <div className="relative flex w-full items-center justify-center pt-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-base font-bold text-white" style={{ background: "linear-gradient(135deg,#c76f93,#ac5c7f)", boxShadow: "0 2px 12px rgba(172,92,127,0.55)" }}>A</span>
          <span className="text-xl font-bold tracking-tight text-white">Allura</span>
        </div>
      </div>

      <div className="relative w-full flex-1">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
          className="mx-auto mt-12 mb-2 max-w-3xl px-5 text-center"
        >
          <button
            onClick={() => router.back()}
            className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            חזרה
          </button>

          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5" style={{ background: "rgba(212,168,83,0.14)", border: "1px solid rgba(212,168,83,0.30)" }}>
            <Crown className="h-3.5 w-3.5" style={{ color: "#e5bd6a" }} />
            <span className="text-xs font-semibold tracking-wide" style={{ color: "#e5bd6a" }}>שדרוג לפלטינום</span>
          </div>

          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
            פותחים את כל כלי הצמיחה
          </h1>
          <p className="mx-auto mt-4 flex max-w-md items-center justify-center gap-1.5 text-base leading-7" style={{ color: "rgba(255,255,255,0.60)" }}>
            <Sparkles className="h-4 w-4 shrink-0" style={{ color: "rgba(229,189,106,0.8)" }} />
            תחזית הכנסות, לקוחות בסיכון, קמפיינים אוטומטיים ועוד
          </p>
        </motion.div>

        <PlanCheckout
          plan={PLATINUM_PLAN}
          submitLabel={`שדרוג עכשיו — ₪${PLATINUM_PLAN.price}/חודש`}
        />
      </div>
    </div>
  );
}
