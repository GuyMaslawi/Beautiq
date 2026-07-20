import Link from "next/link";
import { Lock, Crown, Check, Sparkles } from "lucide-react";
import { PLATINUM_PLAN } from "@/lib/plans";

/**
 * In-place upsell shown when a Premium user opens a Platinum-only feature. Rather
 * than redirecting (a dead-end), we keep them in context and show what the
 * feature offers with a clear upgrade CTA. Server component — pure markup.
 */
export function PlatinumLock({
  feature,
  description,
}: {
  feature: string;
  description?: string;
}) {
  return (
    <div
      className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-[2rem] p-8 text-center sm:p-10"
      style={{
        background: "linear-gradient(160deg, #2e0d20 0%, #4c1535 50%, #3a0e27 100%)",
        border: "1.5px solid rgba(212,168,83,0.35)",
        boxShadow: "0 24px 70px rgba(46,13,32,0.45), 0 0 0 1px rgba(212,168,83,0.10)",
      }}
    >
      <div
        className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full opacity-25"
        style={{ background: "radial-gradient(circle, rgba(212,168,83,0.6) 0%, transparent 70%)" }}
      />

      <div className="relative">
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: "rgba(212,168,83,0.16)", border: "1px solid rgba(212,168,83,0.38)" }}
        >
          <Lock className="h-7 w-7" style={{ color: "#e5bd6a" }} />
        </div>

        <div
          className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1"
          style={{ background: "rgba(212,168,83,0.15)", border: "1px solid rgba(212,168,83,0.30)" }}
        >
          <Crown className="h-3.5 w-3.5" style={{ color: "#e5bd6a" }} />
          <span className="text-xs font-bold tracking-wide" style={{ color: "#e5bd6a" }}>פיצ׳ר פלטינום</span>
        </div>

        <h2 className="font-display mb-3 text-2xl font-semibold text-white sm:text-3xl">{feature}</h2>
        <p className="mx-auto mb-7 max-w-md text-sm leading-6" style={{ color: "rgba(255,255,255,0.62)" }}>
          {description ??
            "הכלי הזה זמין בתוכנית פלטינום — הכלים המתקדמים שהופכים את Allura לעוזר העסקי החכם שלך."}
        </p>

        {/* Platinum highlights */}
        <ul className="mx-auto mb-8 grid max-w-md gap-2.5 text-right sm:grid-cols-2">
          {PLATINUM_PLAN.features.slice(0, 6).map((f) => (
            <li key={f} className="flex items-center gap-2">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ background: "rgba(212,168,83,0.18)", border: "1px solid rgba(212,168,83,0.35)" }}
              >
                <Check className="h-3 w-3" style={{ color: "#e5bd6a" }} />
              </span>
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.82)" }}>{f}</span>
            </li>
          ))}
        </ul>

        <Link
          href="/upgrade"
          className="inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-3.5 text-base font-bold transition-transform duration-200 hover:-translate-y-0.5"
          style={{
            background: "linear-gradient(135deg, #e5bd6a 0%, #c09560 100%)",
            color: "#3a2200",
            boxShadow: "0 8px 24px rgba(212,168,83,0.45)",
          }}
        >
          <Sparkles className="h-5 w-5" />
          שדרוג לפלטינום — ₪{PLATINUM_PLAN.price}/חודש
        </Link>

        <p className="mt-4 text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>
          שדרוג מיידי · ביטול בכל רגע · ללא התחייבות
        </p>
      </div>
    </div>
  );
}
