"use client";

/*
 * ALLURA DESIGN LAB — /design-lab/allura-luxury
 * Isolated visual prototype hub. Switches between three luxury dashboard
 * concepts (desktop + mobile) and shows each concept's design dossier.
 * NO real app logic, data, Prisma, server actions, or WhatsApp/Meta code.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Monitor, Smartphone, Lock, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandCenter } from "./_concept-command";
import { Concierge } from "./_concept-concierge";
import { Cockpit } from "./_concept-cockpit";
import { dossiers, DossierPanel } from "./_dossiers";

const ease = [0.22, 1, 0.36, 1] as const;

type ConceptId = "command" | "concierge" | "cockpit";
type Viewport = "desktop" | "mobile";

const concepts: { id: ConceptId; index: string; he: string; en: string }[] = [
  { id: "command", index: "01", he: "מרכז השליטה", en: "Command Center" },
  { id: "concierge", index: "02", he: "הקונסיירז׳", en: "AI Concierge" },
  { id: "cockpit", index: "03", he: "הקוקפיט", en: "Studio Cockpit" },
];

function renderConcept(id: ConceptId, mode: Viewport) {
  if (id === "command") return <CommandCenter mode={mode} />;
  if (id === "concierge") return <Concierge mode={mode} />;
  return <Cockpit mode={mode} />;
}

export default function AlluraLuxuryLab() {
  const [active, setActive] = useState<ConceptId>("command");
  const [viewport, setViewport] = useState<Viewport>("desktop");

  // Read concept/viewport from the URL after mount (hydration-safe — server and
  // client both render the same fallback first, then sync to ?c= / ?v= params).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const c = p.get("c");
    const v = p.get("v");
    // One-time URL→state sync on mount (the documented exception to set-state-in-effect):
    // keeps the first paint identical on server and client, then deep-links to ?c= / ?v=.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (c === "command" || c === "concierge" || c === "cockpit") setActive(c);
    if (v === "desktop" || v === "mobile") setViewport(v);
  }, []);

  const dossier = dossiers.find((d) => d.id === active)!;

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-10">
      {/* atmospheric drifting blobs */}
      <div className="lab-blob" style={{ top: "-6rem", right: "-4rem", width: "32rem", height: "32rem", background: "radial-gradient(circle, rgba(231,169,196,0.35), transparent 70%)" }} />
      <div className="lab-blob" style={{ top: "30rem", left: "-8rem", width: "30rem", height: "30rem", background: "radial-gradient(circle, rgba(185,143,206,0.3), transparent 70%)", animationDelay: "-7s" }} />

      {/* ── Masthead ─────────────────────────────────────── */}
      <header className="relative text-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}
          className="inline-flex items-center gap-2 rounded-full border border-[rgba(236,217,175,0.25)] bg-[rgba(74,33,66,0.3)] px-4 py-1.5"
        >
          <Lock size={12} className="text-[var(--lab-gold)]" />
          <span className="lab-eyebrow !tracking-[0.3em]">DESIGN LAB · ISOLATED PROTOTYPE</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1, ease }}
          className="lab-latin lab-gold-text mt-6 text-[clamp(3.5rem,11vw,8rem)] font-semibold leading-[0.9]"
        >
          Allura
        </motion.h1>
        <p className="lab-serif mx-auto mt-2 text-[clamp(1.1rem,3vw,1.7rem)] text-[var(--lab-pearl)]">
          מערכת ההפעלה של עסק היופי
        </p>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[var(--lab-pearl-mute)]">
          שלושה כיוונים חזותיים נועזים — כאילו עוצבו על־ידי סטודיו עיצוב מוביל. יוקרתי, רגשי, נשי, עוצמתי.
          סביבת חקירה ויזואלית בלבד; אינה נוגעת באפליקציה האמיתית.
        </p>
      </header>

      {/* ── Concept switcher ─────────────────────────────── */}
      <div className="mt-12 flex flex-col items-center gap-5">
        <div className="lab-glass lab-edge flex flex-wrap justify-center gap-1.5 rounded-full p-1.5">
          {concepts.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={cn(
                "relative flex items-center gap-2.5 rounded-full px-5 py-2.5 transition-colors",
                active === c.id ? "text-[#2a1228]" : "text-[var(--lab-pearl-soft)] hover:text-[var(--lab-pearl)]",
              )}
            >
              {active === c.id && (
                <motion.span layoutId="conceptPill" transition={{ duration: 0.4, ease }}
                  className="absolute inset-0 rounded-full" style={{ background: "var(--lab-grad-gold)" }} />
              )}
              <span className="lab-latin relative z-10 text-sm font-semibold lab-num">{c.index}</span>
              <span className="relative z-10 text-sm font-medium">{c.he}</span>
            </button>
          ))}
        </div>

        {/* viewport toggle */}
        <div className="lab-glass flex items-center gap-1 rounded-full p-1">
          {([
            { id: "desktop", icon: Monitor, label: "דסקטופ" },
            { id: "mobile", icon: Smartphone, label: "מובייל" },
          ] as const).map((v) => (
            <button key={v.id} onClick={() => setViewport(v.id)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                viewport === v.id ? "lab-medallion-rose" : "text-[var(--lab-pearl-mute)] hover:text-[var(--lab-pearl)]",
              )}>
              <v.icon size={14} /> {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stage ────────────────────────────────────────── */}
      <div className="mt-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={active + viewport}
            id="lab-stage"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.5, ease }}
          >
            {viewport === "desktop" ? (
              <div className="lab-glass lab-edge overflow-hidden rounded-[2rem]">
                {/* faux window chrome */}
                <div className="flex items-center gap-2 border-b border-[rgba(236,217,175,0.12)] px-5 py-3">
                  <span className="h-3 w-3 rounded-full" style={{ background: "var(--lab-grad-rose)" }} />
                  <span className="h-3 w-3 rounded-full" style={{ background: "var(--lab-grad-gold)" }} />
                  <span className="h-3 w-3 rounded-full" style={{ background: "var(--lab-grad-orchid)" }} />
                  <span className="lab-latin mx-auto text-xs tracking-widest text-[var(--lab-pearl-faint)]">
                    allura.app · {dossier.nameEn}
                  </span>
                </div>
                {renderConcept(active, "desktop")}
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="lab-phone w-[400px] max-w-full">
                  <div className="relative overflow-hidden rounded-[2.3rem] bg-[var(--lab-bg)]"
                    style={{ height: 780 }}>
                    {/* notch */}
                    <div className="absolute left-1/2 top-2 z-20 h-6 w-28 -translate-x-1/2 rounded-full bg-[#0c060b]" />
                    <div className="lab-scrollbar-hide h-full overflow-y-auto">
                      {renderConcept(active, "mobile")}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Dossier ──────────────────────────────────────── */}
      <section className="mt-16">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <div className="lab-eyebrow text-[var(--lab-gold)]">CONCEPT {dossier.index}</div>
            <h2 className="lab-serif mt-1 text-3xl font-bold text-[var(--lab-pearl)]">
              {dossier.nameHe} <span className="lab-latin text-xl font-medium text-[var(--lab-pearl-mute)]">· {dossier.nameEn}</span>
            </h2>
            <p className="mt-1 text-sm text-[var(--lab-pearl-mute)]">{dossier.tagline}</p>
          </div>
        </div>
        <p className="lab-serif mb-7 max-w-3xl text-lg leading-relaxed text-[var(--lab-pearl-soft)]">{dossier.essence}</p>
        <DossierPanel d={dossier} />
      </section>

      {/* ── Recommendation ───────────────────────────────── */}
      <section className="mt-16">
        <div className="lab-glass-strong lab-edge-gold relative overflow-hidden rounded-[2rem] p-8 md:p-12">
          <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full opacity-50"
            style={{ background: "radial-gradient(circle, rgba(217,189,132,0.45), transparent 70%)", filter: "blur(40px)" }} />
          <div className="relative">
            <div className="lab-eyebrow flex items-center gap-2 text-[var(--lab-gold)]">
              <Star size={13} /> ההמלצה שלי
            </div>
            <h2 className="lab-serif mt-3 max-w-3xl text-2xl font-bold leading-snug text-[var(--lab-pearl)] md:text-[1.9rem]">
              להפוך את <span className="lab-gold-text">״הקונסיירז׳״</span> לליבת מערכת העיצוב — עם עמוד השדרה התפעולי של <span className="lab-rose-text">״הקוקפיט״</span>.
            </h2>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {[
                { t: "הזהות הרגשית", b: "הקונסיירז׳ הוא ה־wow היחיד שמרגיש כמו מוצר AI יוקרתי ולא לוח ניהול — בדיוק מה שמייצר ׳מי עיצב את זה?׳ ובידול מול כל CRM." },
                { t: "המנוע היומיומי", b: "הקוקפיט נותן את הבהירות התפעולית שבעלת עסק עמוסה צריכה כל יום — ציר זמן וכרטיסים פעולתיים. זה ה־daily driver." },
                { t: "האיחוד", b: "מסך ׳היום׳ נפתח בקונסיירז׳ (מה חשוב + רגש), לחיצה אחת צוללת לקוקפיט (לוח־שנה פעולתי). מרכז השליטה הופך למסך ׳תובנות׳." },
              ].map((x) => (
                <div key={x.t} className="rounded-2xl border border-[rgba(236,217,175,0.14)] bg-[rgba(20,10,19,0.35)] p-5">
                  <div className="lab-serif mb-2 flex items-center gap-2 text-base font-bold text-[var(--lab-pearl)]">
                    <Sparkles size={15} className="text-[var(--lab-gold)]" /> {x.t}
                  </div>
                  <p className="text-sm leading-relaxed text-[var(--lab-pearl-mute)]">{x.b}</p>
                </div>
              ))}
            </div>
            <p className="mt-7 max-w-3xl text-sm leading-relaxed text-[var(--lab-pearl-soft)]">
              מערכת אחת, שלוש שכבות: <b className="text-[var(--lab-pearl)]">קונסיירז׳</b> לרגש ומיקוד · <b className="text-[var(--lab-pearl)]">קוקפיט</b> לתפעול ·
              <b className="text-[var(--lab-pearl)]"> מרכז שליטה</b> לתובנות עומק. שפה חזותית אחת — זכוכית נוזלית, אובערז׳ין, שמפניה ורוז־גולד.
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-[var(--lab-pearl-faint)]">
          סביבה מבודדת · <span className="lab-num">/design-lab/allura-luxury</span> · אינה משנה דפים, נתונים, Prisma, server actions או לוגיקת WhatsApp/Meta.
        </p>
      </section>
    </div>
  );
}
