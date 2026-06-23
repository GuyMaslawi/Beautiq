"use client";

/*
 * CONCEPT 2 — Glam AI Concierge
 * A personal assistant that tells the owner what to do today. Editorial,
 * emotional, single-focus. An iridescent AI orb narrates the day as a
 * ranked feed of "moments". Conversational, not dashboard.
 */
import { motion } from "motion/react";
import {
  Sparkles, ArrowLeft, Crown, Flame, Clock, Wallet,
  TrendingUp, Bell, Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { moments, owner, revenue, nextAppt, automation, appointments } from "./_data";
import { Avatar, LiveDot, Shekel } from "./_ui";

const ease = [0.22, 1, 0.36, 1] as const;

const toneAccent: Record<string, string> = {
  gold: "var(--lab-grad-gold)",
  blush: "var(--lab-grad-blush)",
  orchid: "var(--lab-grad-orchid)",
  live: "var(--lab-grad-rose)",
};
const toneIcon: Record<string, React.ElementType> = {
  gold: Crown, blush: Flame, orchid: Clock, live: Wallet,
};

function Orb({ size = 64 }: { size?: number }) {
  return (
    <span className="lab-orb lab-orb-pulse inline-block" style={{ width: size, height: size }} />
  );
}

function MomentCard({ m, i, featured }: { m: (typeof moments)[number]; i: number; featured?: boolean }) {
  const Icon = toneIcon[m.tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 26, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.7, ease, delay: 0.1 + i * 0.08 }}
      className={cn(
        "lab-lift group relative overflow-hidden rounded-[1.75rem] p-6",
        featured ? "lab-glass-strong lab-edge-gold" : "lab-glass lab-edge",
      )}
    >
      {featured && (
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full opacity-60"
          style={{ background: "radial-gradient(circle, rgba(217,189,132,0.4), transparent 70%)", filter: "blur(34px)" }} />
      )}
      <div className="relative flex gap-5">
        <div className="flex flex-col items-center">
          <span className="lab-latin lab-gold-text text-4xl font-semibold leading-none lab-num">{m.rank}</span>
          <span className="mt-3 grid h-10 w-10 place-items-center rounded-2xl"
            style={{ background: toneAccent[m.tone], color: "#2a1228" }}>
            <Icon size={18} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={cn("lab-serif font-bold text-[var(--lab-pearl)]", featured ? "text-2xl" : "text-xl")}>
            {m.headline}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--lab-pearl-soft)]">{m.body}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="lab-medallion inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
              {m.action} <ArrowLeft size={15} />
            </button>
            {m.stat && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(236,217,175,0.2)] px-3 py-1.5 text-[0.72rem] text-[var(--lab-pearl-mute)]">
                <Sparkles size={12} className="text-[var(--lab-gold)]" /> {m.stat}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function GlanceRail() {
  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease, delay: 0.15 }}
      className="space-y-4"
    >
      <div className="lab-eyebrow-he text-[var(--lab-pearl-mute)]">היום במבט</div>

      {/* next appt */}
      <div className="lab-glass lab-edge rounded-3xl p-5">
        <div className="mb-3 flex items-center gap-2 text-[0.7rem] text-[var(--lab-pearl-mute)]">
          <Clock size={13} className="text-[var(--lab-rose)]" /> התור הבא · בעוד 24 ד׳
        </div>
        <div className="flex items-center gap-3">
          <Avatar initials={nextAppt.initials} tone={nextAppt.tone} size={48} />
          <div>
            <div className="lab-serif text-lg font-bold">{nextAppt.client}</div>
            <div className="text-xs text-[var(--lab-pearl-mute)]">{nextAppt.service} · {nextAppt.time}</div>
          </div>
        </div>
      </div>

      {/* revenue mini */}
      <div className="lab-glass lab-edge rounded-3xl p-5">
        <div className="mb-1 flex items-center gap-2 text-[0.7rem] text-[var(--lab-pearl-mute)]">
          <TrendingUp size={13} className="text-[var(--lab-gold)]" /> הכנסות היום
        </div>
        <div className="lab-serif lab-gold-text text-3xl font-bold lab-num"><Shekel value={revenue.today} /></div>
        <div className="mt-1 text-xs text-[var(--lab-live)]">+{revenue.trend}% מהחודש הקודם</div>
        {/* schedule dots */}
        <div className="mt-4 flex items-center gap-1.5">
          {appointments.map((a, i) => (
            <span key={i} className="h-1.5 flex-1 rounded-full"
              style={{ background: i < revenue.paid - 6 ? "var(--lab-grad-gold)" : "rgba(236,217,175,0.18)" }} />
          ))}
        </div>
        <div className="mt-2 text-[0.65rem] text-[var(--lab-pearl-faint)]">{appointments.length} תורים היום</div>
      </div>

      {/* automation */}
      <div className="lab-glass lab-edge rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[0.7rem] text-[var(--lab-pearl-mute)]">
            <Bell size={13} className="text-[var(--lab-orchid)]" /> אוטומציה
          </span>
          <span className="inline-flex items-center gap-1.5 text-[0.7rem] text-[var(--lab-live)]"><LiveDot /> מחובר</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="lab-serif text-2xl font-bold text-[var(--lab-pearl)] lab-num">{automation.sentToday}</span>
          <span className="text-xs text-[var(--lab-pearl-mute)]">הודעות נשלחו היום</span>
        </div>
      </div>
    </motion.aside>
  );
}

function AskBar() {
  return (
    <div className="lab-glass-strong lab-edge-gold flex items-center gap-3 rounded-full px-5 py-3">
      <Sparkles size={18} className="text-[var(--lab-gold)]" />
      <span className="flex-1 text-sm text-[var(--lab-pearl-mute)]">שאלי את אלורה כל דבר על העסק…</span>
      <button className="lab-medallion grid h-9 w-9 place-items-center rounded-full">
        <Mic size={16} />
      </button>
    </div>
  );
}

export function Concierge({ mode = "desktop" }: { mode?: "desktop" | "mobile" }) {
  const Intro = (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease }}
    >
      <div className="flex items-center gap-4">
        <Orb size={mode === "mobile" ? 56 : 72} />
        <div>
          <div className="lab-eyebrow text-[var(--lab-gold)]">ALLURA CONCIERGE</div>
          <div className="lab-eyebrow-he mt-1 text-[var(--lab-rose)]">הקונסיירז׳ האישי שלך</div>
        </div>
      </div>
      <h1 className={cn("lab-serif mt-6 font-bold leading-[1.15] text-[var(--lab-pearl)]", mode === "mobile" ? "text-[1.7rem]" : "text-[2.6rem]")}>
        בוקר טוב, <span className="lab-irid-text">{owner.name}</span>.<br />
        ריכזתי עבורך את מה שבאמת חשוב היום.
      </h1>
      <p className="mt-4 max-w-xl text-[var(--lab-pearl-mute)]">
        ארבעה דברים דורשים את תשומת ליבך — מסודרים לפי ההשפעה שלהם על ההכנסות והלקוחות שלך.
      </p>
    </motion.div>
  );

  if (mode === "mobile") {
    return (
      <div className="p-5">
        {Intro}
        <div className="mt-6 space-y-4">
          {moments.map((m, i) => (
            <MomentCard key={m.rank} m={m} i={i} featured={i === 0} />
          ))}
        </div>
        <div className="sticky bottom-3 mt-4"><AskBar /></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {Intro}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-4">
          {moments.map((m, i) => (
            <MomentCard key={m.rank} m={m} i={i} featured={i === 0} />
          ))}
          <div className="pt-1"><AskBar /></div>
        </div>
        <GlanceRail />
      </div>
    </div>
  );
}
