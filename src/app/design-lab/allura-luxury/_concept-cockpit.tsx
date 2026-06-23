"use client";

/*
 * CONCEPT 3 — Beauty Studio Cockpit
 * Calendar-first, appointment-first, action-first — but cinematic.
 * A luxurious vertical day-timeline spine with a glowing "now" line and
 * action-rich glass appointment cards. Side rail = cockpit controls.
 */
import { motion } from "motion/react";
import {
  Check, MessageCircle, MoreHorizontal, Crown, Clock, Plus, UserPlus,
  Sparkles, Flame, TrendingUp, ChevronLeft, Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  appointments, nextAppt, revenue, waitlist, emptySlots, owner, automation,
} from "./_data";
import { Avatar, Pill, LiveDot, Ring, Shekel } from "./_ui";

const ease = [0.22, 1, 0.36, 1] as const;

const statusMap: Record<string, { label: string; tone: "gold" | "rose" | "live" | "alert" }> = {
  confirmed: { label: "מאושר", tone: "live" },
  pending: { label: "ממתין לאישור", tone: "alert" },
  deposit: { label: "מקדמה שולמה", tone: "gold" },
  vip: { label: "VIP", tone: "rose" },
};

function NowMarker() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-14 text-left">
        <span className="lab-latin lab-rose-text text-sm font-semibold lab-num">09:06</span>
      </div>
      <div className="relative flex w-4 justify-center">
        <span className="lab-live-dot z-10 h-3 w-3 rounded-full" style={{ background: "var(--lab-rose)" }} />
      </div>
      <div className="flex flex-1 items-center gap-3">
        <span className="lab-eyebrow-he text-[var(--lab-rose)]">עכשיו</span>
        <div className="lab-now-line h-px flex-1 rounded-full" />
      </div>
    </div>
  );
}

function TimelineRow({ a, i }: { a: (typeof appointments)[number]; i: number }) {
  const s = statusMap[a.status];
  const isNext = i === 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: -18, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.6, ease, delay: i * 0.06 }}
      className="flex items-stretch gap-3"
    >
      {/* time rail */}
      <div className="w-14 pt-5 text-left">
        <span className="lab-serif lab-gold-text text-lg font-bold lab-num">{a.time}</span>
      </div>
      {/* spine */}
      <div className="relative flex w-4 justify-center">
        <span className="absolute inset-y-0 w-px" style={{ background: "linear-gradient(to bottom, rgba(236,217,175,0.25), rgba(236,217,175,0.08))" }} />
        <span className="z-10 mt-6 h-2.5 w-2.5 rounded-full ring-4 ring-[rgba(20,10,19,0.9)]"
          style={{ background: isNext ? "var(--lab-grad-rose)" : "rgba(236,217,175,0.5)" }} />
      </div>
      {/* card */}
      <div className={cn(
        "lab-lift mb-3 flex-1 overflow-hidden rounded-3xl p-5",
        isNext ? "lab-glass-strong lab-edge-gold" : "lab-glass lab-edge",
      )}>
        <div className="flex items-start gap-4">
          <Avatar initials={a.initials} tone={a.tone} size={52} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="lab-serif truncate text-lg font-bold text-[var(--lab-pearl)]">{a.client}</h3>
              {a.status === "vip" && <Crown size={15} className="text-[var(--lab-gold)]" />}
            </div>
            <div className="text-sm text-[var(--lab-pearl-soft)]">{a.service}</div>
            <div className="mt-1.5 flex items-center gap-3 text-[0.72rem] text-[var(--lab-pearl-faint)]">
              <span className="inline-flex items-center gap-1"><Clock size={12} /> {a.duration}</span>
              <span className="lab-num font-semibold text-[var(--lab-rose)]"><Shekel value={a.price} /></span>
            </div>
          </div>
          <Pill tone={s.tone} className="!px-2.5 !py-0.5 !text-[0.6rem]">{s.label}</Pill>
        </div>
        {/* inline actions */}
        <div className="mt-4 flex items-center gap-2">
          <button className="lab-medallion inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.78rem] font-bold">
            <Check size={13} /> אישור
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(111,224,176,0.35)] bg-[rgba(111,224,176,0.08)] px-3.5 py-1.5 text-[0.78rem] font-medium text-[var(--lab-live)]">
            <MessageCircle size={13} /> וואטסאפ
          </button>
          <button className="grid h-7 w-7 place-items-center rounded-full border border-[rgba(236,217,175,0.2)] text-[var(--lab-pearl-mute)]">
            <MoreHorizontal size={15} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

const cockpitActions = [
  { label: "תור חדש", icon: Plus },
  { label: "לקוחה", icon: UserPlus },
  { label: "הודעה", icon: MessageCircle },
  { label: "מילוי חלון", icon: Sparkles },
];

function SideRail() {
  return (
    <div className="space-y-4">
      {/* next appt hero */}
      <motion.div
        initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }} transition={{ duration: 0.6, ease }}
        className="lab-glass-strong lab-edge-gold relative overflow-hidden rounded-[1.75rem] p-6">
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full opacity-60"
          style={{ background: "radial-gradient(circle, rgba(231,169,196,0.4), transparent 70%)", filter: "blur(28px)" }} />
        <div className="relative">
          <div className="lab-eyebrow-he text-[var(--lab-rose)]">התור הבא</div>
          <div className="mt-3 flex items-center gap-3">
            <Avatar initials={nextAppt.initials} tone={nextAppt.tone} size={56} />
            <div>
              <div className="lab-serif text-xl font-bold">{nextAppt.client}</div>
              <div className="text-xs text-[var(--lab-pearl-mute)]">{nextAppt.service}</div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-[rgba(20,10,19,0.45)] p-3">
            <div>
              <div className="lab-serif text-2xl font-bold lab-rose-text lab-num">{nextAppt.time}</div>
              <div className="text-[0.62rem] text-[var(--lab-pearl-faint)]">בעוד 24 דקות</div>
            </div>
            <button className="lab-medallion inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold">
              <Check size={14} /> אישור הגעה
            </button>
          </div>
        </div>
      </motion.div>

      {/* quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }} transition={{ duration: 0.6, ease, delay: 0.08 }}
        className="lab-glass lab-edge rounded-[1.75rem] p-5">
        <div className="lab-eyebrow-he mb-3 text-[var(--lab-pearl-mute)]">פעולות מהירות</div>
        <div className="grid grid-cols-2 gap-2.5">
          {cockpitActions.map((a) => (
            <button key={a.label}
              className="lab-lift flex flex-col items-center gap-2 rounded-2xl border border-[rgba(236,217,175,0.14)] bg-[rgba(74,33,66,0.35)] py-4 text-xs font-medium text-[var(--lab-pearl-soft)] transition-colors hover:border-[rgba(217,189,132,0.45)] hover:text-[var(--lab-gold)]">
              <a.icon size={18} className="text-[var(--lab-gold)]" />
              {a.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* revenue + automation row */}
      <motion.div
        initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }} transition={{ duration: 0.6, ease, delay: 0.16 }}
        className="lab-glass lab-edge flex items-center gap-4 rounded-[1.75rem] p-5">
        <Ring value={revenue.month} max={revenue.monthTarget} size={92} stroke={7}>
          <div className="lab-serif text-sm font-bold lab-gold-text lab-num">
            {Math.round((revenue.month / revenue.monthTarget) * 100)}%
          </div>
        </Ring>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-[0.7rem] text-[var(--lab-pearl-mute)]">
            <TrendingUp size={13} className="text-[var(--lab-gold)]" /> הכנסות החודש
          </div>
          <div className="lab-serif text-2xl font-bold lab-gold-text lab-num"><Shekel value={revenue.month} /></div>
          <div className="mt-1 inline-flex items-center gap-1.5 text-[0.7rem] text-[var(--lab-live)]">
            <LiveDot /> {automation.sentToday} הודעות אוטומטיות היום
          </div>
        </div>
      </motion.div>

      {/* empty slots / waitlist quick fill */}
      <motion.div
        initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }} transition={{ duration: 0.6, ease, delay: 0.24 }}
        className="lab-glass lab-edge rounded-[1.75rem] p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="lab-eyebrow-he text-[var(--lab-pearl-mute)]">חלונות פנויים</span>
          <button className="flex items-center gap-1 text-[0.7rem] text-[var(--lab-gold)]">מלאי הכל <ChevronLeft size={13} /></button>
        </div>
        {emptySlots.slice(0, 1).map((s, i) => (
          <div key={i} className="mb-2 flex items-center justify-between rounded-xl border border-dashed border-[rgba(236,217,175,0.22)] bg-[rgba(217,189,132,0.06)] px-3 py-2">
            <span className="text-xs text-[var(--lab-pearl-soft)]">{s.day} · <span className="lab-gold-text lab-num font-bold">{s.time}</span></span>
            <span className="text-[0.62rem] text-[var(--lab-pearl-faint)]">{s.gap}</span>
          </div>
        ))}
        {waitlist.slice(0, 2).map((w, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl px-1 py-1.5">
            {w.hot
              ? <Flame size={12} className="text-[var(--lab-hot)]" />
              : <span className="h-1.5 w-1.5 rounded-full bg-[var(--lab-pearl-faint)]" />}
            <span className="flex-1 truncate text-[0.72rem] text-[var(--lab-pearl-soft)]">{w.client} · {w.service}</span>
            <span className="text-[0.6rem] text-[var(--lab-pearl-faint)]">{w.when}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function CockpitHeader({ mobile = false }: { mobile?: boolean }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <div className="lab-eyebrow-he text-[var(--lab-rose)]">יום שלישי · 21 ביוני</div>
        <h1 className={cn("lab-serif font-bold", mobile ? "text-xl" : "text-2xl")}>
          היומן של <span className="lab-gold-text">{owner.name}</span>
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(111,224,176,0.3)] bg-[rgba(111,224,176,0.08)] px-3 py-1.5 text-[0.7rem] text-[var(--lab-live)]">
          <Bell size={12} /> {appointments.length} תורים · ₪{appointments.reduce((s, a) => s + a.price, 0).toLocaleString("he-IL")}
        </span>
        {!mobile && <Avatar initials={owner.initials} tone="gold" size={48} />}
      </div>
    </div>
  );
}

export function Cockpit({ mode = "desktop" }: { mode?: "desktop" | "mobile" }) {
  const timeline = (
    <div>
      <NowMarker />
      {appointments.map((a, i) => (
        <TimelineRow key={i} a={a} i={i} />
      ))}
    </div>
  );

  if (mode === "mobile") {
    return (
      <div className="p-5">
        <CockpitHeader mobile />
        {/* next appt strip */}
        <div className="lab-glass-strong lab-edge-gold mb-5 flex items-center gap-3 rounded-3xl p-4">
          <Avatar initials={nextAppt.initials} tone={nextAppt.tone} size={48} />
          <div className="flex-1">
            <div className="lab-eyebrow-he text-[var(--lab-rose)]">התור הבא · {nextAppt.time}</div>
            <div className="lab-serif text-lg font-bold">{nextAppt.client}</div>
          </div>
          <button className="lab-medallion grid h-10 w-10 place-items-center rounded-full"><Check size={16} /></button>
        </div>
        {timeline}
        <div className="lab-glass-strong lab-edge sticky bottom-3 mt-2 flex items-center justify-around rounded-full p-2">
          {cockpitActions.map((a) => (
            <button key={a.label} className="grid place-items-center px-3 py-1.5 text-[var(--lab-pearl-mute)]">
              <a.icon size={18} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <CockpitHeader />
      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <div className="lab-glass lab-edge rounded-[1.75rem] p-6">{timeline}</div>
        <SideRail />
      </div>
    </div>
  );
}
