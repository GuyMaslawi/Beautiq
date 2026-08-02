"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, Check, ShieldCheck, Flower2, Loader2 } from "lucide-react";
import { ALLURA_PLAN } from "@/lib/plans";
import { PlanCheckout } from "@/components/plans/plan-checkout";

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

/* ── Headline above the checkout ────────────────────────────────────────── */
function SubscribeHeader({ userName }: { userName: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE }}
      className="relative mx-auto w-full max-w-4xl px-5 pt-8 text-center"
    >
      <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full px-4 py-1" style={{ background: "rgba(199,111,147,0.12)", border: "1px solid rgba(199,111,147,0.26)" }}>
        <Sparkles className="h-3.5 w-3.5" style={{ color: "#e7a9c4" }} />
        <span className="text-xs font-semibold tracking-wide" style={{ color: "#e7a9c4" }}>עוד צעד אחד — ואת בפנים</span>
      </div>
      <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl md:text-4xl">
        {userName ? `${userName}, ` : ""}מנוי אחד. כל הכלים.
      </h1>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6" style={{ color: "rgba(255,255,255,0.60)" }}>
        ניהול מלא של העסק בעברית, בלי מדרגות ובלי תוספות — ₪{ALLURA_PLAN.price} לחודש.
        אפשר לבטל בכל רגע, ללא התחייבות.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
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
      </div>
    </motion.div>
  );
}

/**
 * מסך ביניים אחרי חזרה מעמוד התשלום של Grow, כשההודעה מהשרת של Grow עדיין לא
 * הגיעה. בלי המסך הזה בעלת העסק הייתה נוחתת חזרה על מסך התשלום כאילו לא קרה
 * כלום — והפעולה הטבעית הייתה לשלם שוב וליצור חיוב והוראת קבע שניים.
 *
 * העמוד עצמו (server component) מפנה ל-/dashboard ברגע שהמנוי מופעל, ולכן
 * רענון פשוט מספיק כדי להשלים את המעבר. אנחנו מרעננים אוטומטית כל 3 שניות.
 */
function PaymentPending({ onRetryCheckout }: { onRetryCheckout: () => void }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="relative mx-auto w-full max-w-lg px-5 py-8 text-center">
      <div
        className="rounded-[2rem] p-8 sm:p-10"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(212,168,83,0.28)",
          boxShadow: "0 24px 70px rgba(19,10,25,0.55)",
        }}
      >
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: "rgba(212,168,83,0.16)", border: "1px solid rgba(212,168,83,0.38)" }}
        >
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#e5bd6a" }} />
        </div>

        <h1 className="font-display mb-3 text-2xl font-semibold text-white sm:text-3xl">
          קיבלנו את התשלום — עוד רגע את בפנים
        </h1>
        <p className="mx-auto mb-6 max-w-sm text-sm leading-6" style={{ color: "rgba(255,255,255,0.62)" }}>
          אישור התשלום נקלט אצלנו תוך כמה שניות, והמסך יתקדם לבד.
          <br />
          <strong style={{ color: "rgba(255,255,255,0.85)" }}>אין צורך לשלם שוב.</strong>
        </p>

        <button
          type="button"
          onClick={() => router.refresh()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-3.5 text-base font-bold transition-transform duration-200 hover:-translate-y-0.5"
          style={{
            background: "linear-gradient(135deg, #e5bd6a 0%, #c09560 100%)",
            color: "#3a2200",
            boxShadow: "0 8px 24px rgba(212,168,83,0.45)",
          }}
        >
          בדיקת סטטוס עכשיו
        </button>

        <p className="mt-6 text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>
          התשלום לא בוצע בסוף?{" "}
          <button
            type="button"
            onClick={onRetryCheckout}
            className="underline underline-offset-2"
            style={{ color: "rgba(255,255,255,0.62)" }}
          >
            מעבר לתשלום מחדש
          </button>
        </p>
      </div>
    </div>
  );
}

/* ── Root ───────────────────────────────────────────────────────────────── */
export function SubscribeClient({
  userName,
  paymentPending = false,
}: {
  userName: string | null;
  /** חזרנו מעמוד התשלום אך אישור Grow עדיין לא נקלט. */
  paymentPending?: boolean;
}) {
  const [showPending, setShowPending] = useState(paymentPending);

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
          {showPending ? (
            <motion.div key="pending" exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }} className="w-full">
              <PaymentPending onRetryCheckout={() => setShowPending(false)} />
            </motion.div>
          ) : (
            <motion.div key="checkout" className="w-full">
              <SubscribeHeader userName={userName} />
              <PlanCheckout plan={ALLURA_PLAN} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
