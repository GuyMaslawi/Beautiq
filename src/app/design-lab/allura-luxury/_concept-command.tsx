"use client";

/*
 * CONCEPT 1 — Luxury Beauty Command Center
 * A powerful operating system for the business owner. Asymmetric liquid-glass
 * bento, champagne data-viz, revenue pulse hero. Control-room, not CRM.
 */
import { motion } from "motion/react";
import {
  Plus, UserPlus, MessageCircle, Sparkles, TrendingUp, Clock, Crown,
  ArrowLeft, Bell, Star, Wallet, Flame, Check, ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  appointments, nextAppt, opportunities, revenue, automation, waitlist, emptySlots, owner,
} from "./_data";
import { Avatar, Pill, LiveDot, Sparkbars, Ring, Shekel } from "./_ui";

const ease = [0.22, 1, 0.36, 1] as const;

function Tile({
  children, className, area, delay = 0, strong = false,
}: {
  children: React.ReactNode; className?: string; area?: string; delay?: number; strong?: boolean;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.7, ease, delay }}
      style={area ? { gridArea: area } : undefined}
      className={cn(
        strong ? "lab-glass-strong" : "lab-glass",
        "lab-edge lab-lift relative overflow-hidden rounded-[1.75rem] p-6",
        className,
      )}
    >
      {children}
    </motion.section>
  );
}

function TileLabel({ children, icon: Icon }: { children: React.ReactNode; icon: React.ElementType }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Icon size={15} className="text-[var(--lab-gold)]" strokeWidth={1.6} />
      <span className="lab-eyebrow-he text-[var(--lab-pearl-mute)]">{children}</span>
    </div>
  );
}

const statusMap: Record<string, { label: string; tone: "gold" | "rose" | "live" | "alert" | "neutral" }> = {
  confirmed: { label: "מאושר", tone: "live" },
  pending: { label: "ממתין", tone: "alert" },
  deposit: { label: "מקדמה", tone: "gold" },
  vip: { label: "VIP", tone: "rose" },
};

/* ─── Revenue pulse hero ─────────────────────────────────── */
function RevenuePulse({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <div className="absolute -left-10 -top-10 h-44 w-44 rounded-full opacity-50"
        style={{ background: "radial-gradient(circle, rgba(217,189,132,0.4), transparent 70%)", filter: "blur(30px)" }} />
      <div className="relative flex items-start justify-between">
        <div>
          <TileLabel icon={TrendingUp}>דופק ההכנסות</TileLabel>
          <div className="flex items-end gap-2">
            <span className="lab-serif lab-gold-text text-[3.4rem] font-bold leading-none lab-num">
              <Shekel value={revenue.today} />
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--lab-pearl-mute)]">הכנסות היום · {revenue.paid} שולמו</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[rgba(111,224,176,0.3)] bg-[rgba(111,224,176,0.08)] px-3 py-1">
            <TrendingUp size={13} className="text-[var(--lab-live)]" />
            <span className="text-xs font-medium text-[var(--lab-live)]">+{revenue.trend}% מהחודש הקודם</span>
          </div>
        </div>
        {!compact && (
          <Ring value={revenue.month} max={revenue.monthTarget} size={128}>
            <div className="text-center">
              <div className="lab-serif text-xl font-bold lab-gold-text lab-num">
                {Math.round((revenue.month / revenue.monthTarget) * 100)}%
              </div>
              <div className="text-[0.6rem] text-[var(--lab-pearl-faint)]">מהיעד</div>
            </div>
          </Ring>
        )}
      </div>
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-[0.7rem] text-[var(--lab-pearl-mute)]">
          <span>7 הימים האחרונים</span>
          <span className="lab-num">חודשי · <Shekel value={revenue.month} /> / <Shekel value={revenue.monthTarget} /></span>
        </div>
        <Sparkbars values={revenue.weekBars} days={revenue.weekDays} height={compact ? 56 : 76} />
      </div>
    </>
  );
}

/* ─── Next appointment spotlight ─────────────────────────── */
function NextAppt() {
  return (
    <>
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full opacity-60"
        style={{ background: "radial-gradient(circle, rgba(231,169,196,0.4), transparent 70%)", filter: "blur(28px)" }} />
      <div className="relative flex items-center justify-between">
        <TileLabel icon={Clock}>התור הבא</TileLabel>
        <Pill tone="rose"><Crown size={12} /> VIP</Pill>
      </div>
      <div className="relative mt-2 flex items-center gap-4">
        <Avatar initials={nextAppt.initials} tone={nextAppt.tone} size={72} />
        <div>
          <div className="lab-serif text-2xl font-bold text-[var(--lab-pearl)]">{nextAppt.client}</div>
          <div className="text-sm text-[var(--lab-pearl-soft)]">{nextAppt.service}</div>
        </div>
      </div>
      <div className="relative mt-5 flex items-center gap-3">
        <div className="flex-1 rounded-2xl border border-[rgba(236,217,175,0.14)] bg-[rgba(20,10,19,0.4)] p-3 text-center">
          <div className="lab-serif text-2xl font-bold lab-rose-text lab-num">{nextAppt.time}</div>
          <div className="text-[0.62rem] text-[var(--lab-pearl-faint)]">בעוד 24 דקות</div>
        </div>
        <div className="flex-1 rounded-2xl border border-[rgba(236,217,175,0.14)] bg-[rgba(20,10,19,0.4)] p-3 text-center">
          <div className="lab-serif text-2xl font-bold text-[var(--lab-pearl)] lab-num"><Shekel value={nextAppt.price} /></div>
          <div className="text-[0.62rem] text-[var(--lab-pearl-faint)]">{nextAppt.duration}</div>
        </div>
      </div>
      <div className="relative mt-4 flex gap-2">
        <button className="lab-medallion flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold">
          <Check size={15} /> אישור הגעה
        </button>
        <button className="flex items-center justify-center gap-2 rounded-full border border-[rgba(111,224,176,0.35)] bg-[rgba(111,224,176,0.08)] px-4 text-sm font-medium text-[var(--lab-live)]">
          <MessageCircle size={15} /> וואטסאפ
        </button>
      </div>
    </>
  );
}

/* ─── Today's flow timeline strip ────────────────────────── */
function TodayFlow() {
  return (
    <>
      <div className="flex items-center justify-between">
        <TileLabel icon={Clock}>מסלול היום · {appointments.length} תורים</TileLabel>
        <button className="flex items-center gap-1 text-xs text-[var(--lab-pearl-mute)] transition-colors hover:text-[var(--lab-gold)]">
          כל היומן <ChevronLeft size={14} />
        </button>
      </div>
      <div className="lab-scrollbar-hide -mx-2 flex gap-3 overflow-x-auto px-2 pb-1">
        {appointments.map((a, i) => {
          const s = statusMap[a.status];
          return (
            <div key={i}
              className="lab-lift group relative min-w-[176px] shrink-0 overflow-hidden rounded-2xl border border-[rgba(236,217,175,0.12)] bg-[rgba(42,18,40,0.5)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="lab-serif text-lg font-bold lab-gold-text lab-num">{a.time}</span>
                <Pill tone={s.tone} className="!px-2 !py-0.5 !text-[0.6rem]">{s.label}</Pill>
              </div>
              <div className="flex items-center gap-2.5">
                <Avatar initials={a.initials} tone={a.tone} size={36} ring={false} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--lab-pearl)]">{a.client}</div>
                  <div className="truncate text-[0.7rem] text-[var(--lab-pearl-mute)]">{a.service}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[rgba(236,217,175,0.1)] pt-2.5">
                <span className="text-[0.7rem] text-[var(--lab-pearl-faint)]">{a.duration}</span>
                <span className="lab-num text-sm font-semibold text-[var(--lab-rose)]"><Shekel value={a.price} /></span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ─── Opportunities ──────────────────────────────────────── */
const oppIcon: Record<string, React.ElementType> = {
  winback: Flame, deposit: Wallet, review: Star, rebook: Sparkles,
};
function Opportunities() {
  return (
    <>
      <TileLabel icon={Sparkles}>הזדמנויות חכמות</TileLabel>
      <div className="space-y-2.5">
        {opportunities.slice(0, 3).map((o, i) => {
          const Icon = oppIcon[o.kind];
          return (
            <div key={i}
              className="lab-lift group flex items-center gap-3 rounded-2xl border border-[rgba(236,217,175,0.1)] bg-[rgba(20,10,19,0.35)] p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                style={{ background: "var(--lab-grad-rose)", color: "#3a1226" }}>
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[var(--lab-pearl)]">{o.title}</div>
                <div className="truncate text-[0.7rem] text-[var(--lab-pearl-mute)]">{o.meta}</div>
              </div>
              <ArrowLeft size={16} className="shrink-0 text-[var(--lab-pearl-faint)] transition-all group-hover:-translate-x-1 group-hover:text-[var(--lab-gold)]" />
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ─── Automation / WhatsApp ──────────────────────────────── */
function AutomationTile() {
  return (
    <>
      <div className="flex items-center justify-between">
        <TileLabel icon={Bell}>אוטומציה</TileLabel>
        <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium text-[var(--lab-live)]">
          <LiveDot /> מחובר
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="lab-serif text-4xl font-bold lab-gold-text lab-num">{automation.sentToday}</div>
        <div className="text-xs text-[var(--lab-pearl-mute)]">הודעות נשלחו<br />אוטומטית היום</div>
      </div>
      <div className="mt-4 space-y-2">
        {automation.flows.slice(0, 3).map((f, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl bg-[rgba(20,10,19,0.35)] px-3 py-2">
            <span className="text-xs text-[var(--lab-pearl-soft)]">{f.name}</span>
            <span className={cn(
              "relative inline-flex h-4 w-7 items-center rounded-full px-0.5 transition-colors",
              f.on ? "justify-end" : "justify-start",
            )} style={{ background: f.on ? "var(--lab-grad-rose)" : "rgba(236,217,175,0.15)" }}>
              <span className="h-3 w-3 rounded-full bg-white shadow" />
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─── Waitlist + empty slots ─────────────────────────────── */
function WaitlistTile() {
  return (
    <>
      <TileLabel icon={Clock}>חלונות פנויים · המתנה</TileLabel>
      <div className="mb-3 space-y-2">
        {emptySlots.slice(0, 2).map((s, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl border border-dashed border-[rgba(236,217,175,0.22)] bg-[rgba(217,189,132,0.06)] px-3 py-2">
            <span className="text-xs text-[var(--lab-pearl-soft)]">{s.day} · <span className="lab-num lab-gold-text font-bold">{s.time}</span></span>
            <span className="text-[0.65rem] text-[var(--lab-pearl-faint)]">{s.gap}</span>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {waitlist.slice(0, 2).map((w, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-xl bg-[rgba(20,10,19,0.35)] px-3 py-2">
            {w.hot && <Flame size={13} className="text-[var(--lab-hot)]" />}
            <span className="flex-1 truncate text-xs text-[var(--lab-pearl-soft)]">{w.client} · {w.service}</span>
            <span className="text-[0.65rem] text-[var(--lab-pearl-faint)]">{w.when}</span>
          </div>
        ))}
      </div>
    </>
  );
}

const actions = [
  { label: "תור חדש", icon: Plus },
  { label: "לקוחה חדשה", icon: UserPlus },
  { label: "שליחת הודעה", icon: MessageCircle },
  { label: "מילוי חלון", icon: Sparkles },
];

function Header() {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <Avatar initials={owner.initials} tone="gold" size={52} />
        <div>
          <div className="lab-eyebrow-he text-[var(--lab-rose)]">יום שלישי · 21 ביוני</div>
          <h1 className="lab-serif text-2xl font-bold text-[var(--lab-pearl)]">
            בוקר טוב, <span className="lab-gold-text">{owner.name}</span>
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {actions.map((a) => (
          <button key={a.label}
            className="lab-lift inline-flex items-center gap-2 rounded-full border border-[rgba(236,217,175,0.18)] bg-[rgba(74,33,66,0.4)] px-4 py-2 text-sm font-medium text-[var(--lab-pearl-soft)] transition-colors hover:border-[rgba(217,189,132,0.5)] hover:text-[var(--lab-gold)]">
            <a.icon size={15} /> {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CommandCenter({ mode = "desktop" }: { mode?: "desktop" | "mobile" }) {
  if (mode === "mobile") {
    return (
      <div className="p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="lab-eyebrow-he text-[var(--lab-rose)]">יום שלישי · 21 ביוני</div>
            <h1 className="lab-serif text-xl font-bold">בוקר טוב, <span className="lab-gold-text">{owner.name}</span></h1>
          </div>
          <Avatar initials={owner.initials} tone="gold" size={44} />
        </div>
        <div className="space-y-4">
          <Tile className="!p-5"><RevenuePulse compact /></Tile>
          <Tile className="!p-5" strong><NextAppt /></Tile>
          <Tile className="!p-5"><TodayFlow /></Tile>
          <Tile className="!p-5"><Opportunities /></Tile>
          <Tile className="!p-5"><AutomationTile /></Tile>
          <Tile className="!p-5"><WaitlistTile /></Tile>
        </div>
        {/* bottom action dock */}
        <div className="lab-glass-strong lab-edge sticky bottom-3 mt-4 flex items-center justify-around rounded-full p-2">
          {actions.map((a) => (
            <button key={a.label} className="grid place-items-center gap-1 px-2 py-1 text-[var(--lab-pearl-mute)]">
              <a.icon size={18} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <Header />
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "repeat(6, 1fr)",
          gridTemplateAreas: `
            "pulse pulse pulse next next next"
            "pulse pulse pulse next next next"
            "flow flow flow flow flow flow"
            "opps opps auto auto wait wait"
          `,
        }}
      >
        <Tile area="pulse" delay={0.02} strong><RevenuePulse /></Tile>
        <Tile area="next" delay={0.08} strong><NextAppt /></Tile>
        <Tile area="flow" delay={0.14}><TodayFlow /></Tile>
        <Tile area="opps" delay={0.2}><Opportunities /></Tile>
        <Tile area="auto" delay={0.26}><AutomationTile /></Tile>
        <Tile area="wait" delay={0.32}><WaitlistTile /></Tile>
      </div>
    </div>
  );
}
