"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { CheckCircle2, MessageCircle, Sparkles, Star, Wallet } from "lucide-react";
import { BRAND } from "@/lib/constants/he";
import { APP_DOMAIN } from "@/lib/config";

/* ── static preview data ────────────────────────────────────────────────── */

const NAV_GROUPS_PREVIEW = [
  {
    label: "ניהול יומי",
    items: [
      { label: "לוח הבקרה", active: true },
      { label: "תורים", active: false },
      { label: "לקוחות", active: false },
    ],
  },
  {
    label: "העסק",
    items: [
      { label: "שירותים", active: false },
      { label: "שעות פעילות", active: false },
      { label: "עמוד לקוחות", active: false },
    ],
  },
  {
    label: "הגדלת הכנסות",
    items: [
      { label: "החזרת לקוחות", active: false },
      { label: "רשימת המתנה", active: false },
      { label: "כספים", active: false },
    ],
  },
];

const METRICS_PREVIEW = [
  { label: "הכנסה החודש", value: "₪4,200", accent: true },
  { label: "פגישות היום", value: "6", accent: true },
  { label: "לקוחות פעילים", value: "84", accent: false },
  { label: "ממתינות לאישור", value: "2", accent: false },
];

const BOOKINGS_PREVIEW = [
  { name: "נועה לוי", service: "טיפול פנים", time: "10:00", approved: true },
  { name: "מיה כהן", service: "עיצוב גבות", time: "11:30", approved: false },
  { name: "שירה גולן", service: "לק ג׳ל", time: "13:00", approved: true },
];

const TRUST_POINTS_LEFT = [
  "עברית מלאה",
  "מותאם לעסקי יופי בישראל",
  "ניהול לקוחות ותורים",
  "תזכורות ומעקב",
  "CRM מובנה",
];

const FORM_TRUST_PILLS = [
  "עברית מלאה",
  "מותאם לעסקי יופי בישראל",
  "ניהול תורים, לקוחות ושימור במקום אחד",
];

/* ── form panel ──────────────────────────────────────────────────────────── */
function FormPanel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="app-ambient relative flex w-full shrink-0 flex-col justify-center overflow-hidden px-4 py-10 sm:px-6 sm:py-12 md:w-[480px] md:px-10"
    >
      <div className="aura-card relative mx-auto w-full max-w-[400px] rounded-3xl px-6 py-8 sm:px-8">
        {/* Brand mark */}
        <Link href="/login" className="mb-8 flex items-center gap-3 no-underline">
          <span className="brand-chip flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-bold">
            A
          </span>
          <div>
            <span className="text-foreground block text-xl font-bold tracking-tight leading-none">
              {BRAND.name}
            </span>
            <span className="text-muted block text-xs mt-0.5">ה-CRM לעסקי יופי</span>
          </div>
        </Link>

        {children}

        {/* Trust pills — subtle social proof */}
        <div className="mt-8 pt-6">
          <div className="editorial-rule mb-5" />
          <div className="flex flex-wrap gap-2">
            {FORM_TRUST_PILLS.map((pill) => (
              <div
                key={pill}
                className="flex items-center gap-1.5 rounded-full border border-[var(--primary)]/15 bg-[var(--primary)]/5 px-3 py-1.5"
              >
                <CheckCircle2 className="text-primary h-3 w-3 shrink-0" />
                <span className="text-muted text-xs font-medium">
                  {pill}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── preview panel ───────────────────────────────────────────────────────── */
function PreviewPanel() {
  return (
    <div
      className="relative hidden flex-1 flex-col overflow-hidden md:flex"
      style={{
        background:
          "linear-gradient(155deg, #130a19 0%, #231131 35%, #3c1f3a 65%, #1b0f22 100%)",
      }}
    >
      {/* Atmospheric glow orbs */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div style={{ position: "absolute", top: "-100px", right: "-100px", width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle,rgba(199,111,147,.22) 0%,transparent 70%)", filter: "blur(60px)" }} />
        <div style={{ position: "absolute", bottom: "-90px", left: "-90px", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(192,149,96,.14) 0%,transparent 70%)", filter: "blur(55px)" }} />
        <div style={{ position: "absolute", top: "38%", left: "8%", width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle,rgba(172,92,127,.13) 0%,transparent 70%)", filter: "blur(70px)" }} />
        <div style={{ position: "absolute", top: "60%", right: "5%", width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle,rgba(150,80,200,.10) 0%,transparent 70%)", filter: "blur(55px)" }} />
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-10 py-14">

        {/* Eyebrow pill */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="mb-5 w-full max-w-md"
        >
          <div
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5"
            style={{ background: "rgba(199,111,147,.10)", border: "1px solid rgba(199,111,147,.22)" }}
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: "#c76f93" }} />
            <span className="text-xs font-semibold tracking-wide" style={{ color: "rgba(199,111,147,.9)" }}>
              פלטפורמה חכמה לעסקי יופי
            </span>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mb-7 w-full max-w-md"
        >
          <h2
            className="font-display font-semibold leading-tight text-white"
            style={{ fontSize: "2.35rem", letterSpacing: "-0.02em" }}
          >
            פחות ביטולים.
            <br />
            <span style={{ color: "#c76f93" }}>יותר לקוחות חוזרות.</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,.52)" }}>
            הסטודיו שלך מסודר, מקצועי ורווחי יותר — במקום אחד.
          </p>
          {/* social proof */}
          <div className="mt-4 flex items-center gap-2.5">
            <div className="flex items-center gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-3.5 w-3.5" style={{ color: "#e7a9c4", fill: "#e7a9c4" }} />
              ))}
            </div>
            <span className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
              אהוב על בעלות עסקי יופי בישראל
            </span>
          </div>
        </motion.div>

        {/* Browser mockup */}
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-md"
          style={{ paddingTop: "20px", paddingBottom: "16px" }}
        >
          {/* Floating revenue badge — top-left */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.55 }}
            className="absolute top-0 left-0 z-10 flex items-center gap-2 rounded-xl px-3 py-2"
            style={{
              background: "rgba(255,255,255,.08)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(255,255,255,.12)",
              boxShadow: "0 8px 24px rgba(0,0,0,.28)",
            }}
          >
            <Wallet className="h-4 w-4 shrink-0" style={{ color: "#e7a9c4" }} />
            <div>
              <p className="text-[9px] font-medium" style={{ color: "rgba(255,255,255,.5)" }}>הכנסות החודש</p>
              <p className="text-sm font-bold text-white">₪4,200</p>
            </div>
            <div className="rounded-md px-1.5 py-0.5" style={{ background: "rgba(50,200,90,.18)" }}>
              <span className="text-[9px] font-bold" style={{ color: "#52c87a" }}>↑ 12%</span>
            </div>
          </motion.div>

          {/* Outer glow layer */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              boxShadow: "0 0 60px rgba(199,111,147,0.18), 0 0 120px rgba(172,92,127,0.10)",
              zIndex: 0,
            }}
          />

          {/* Browser chrome */}
          <div
            className="relative w-full overflow-hidden rounded-2xl"
            style={{
              boxShadow:
                "0 40px 90px rgba(0,0,0,.60), 0 12px 30px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.08)",
              zIndex: 1,
            }}
          >
            {/* Browser bar */}
            <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: "#180e1c" }}>
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: "rgba(255,90,90,.7)" }} />
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: "rgba(255,200,50,.7)" }} />
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: "rgba(50,215,75,.7)" }} />
              </div>
              <div
                className="flex-1 rounded-md px-3 py-1 text-center text-xs"
                style={{ background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.30)" }}
              >
                {APP_DOMAIN}/dashboard
              </div>
            </div>

            {/* App shell — RTL layout: sidebar on right */}
            <div className="flex flex-row-reverse" style={{ height: 330, background: "#f5f0f3" }}>

              {/* Sidebar — right side in RTL */}
              <aside
                className="flex w-[110px] shrink-0 flex-col"
                style={{
                  background: "linear-gradient(180deg, #1a0d22 0%, #2b1530 100%)",
                  borderLeft: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                {/* Brand */}
                <div
                  className="flex h-9 items-center gap-1.5 px-2.5"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white text-[8px] font-bold"
                    style={{
                      background: "linear-gradient(135deg,#c76f93,#ac5c7f)",
                      boxShadow: "0 1px 6px rgba(172,92,127,0.50)",
                    }}
                  >
                    A
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.90)" }}>Allura</span>
                </div>

                {/* Business identity */}
                <div
                  className="flex items-center gap-1.5 px-2 py-2"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8px] font-bold"
                    style={{
                      background: "linear-gradient(135deg,rgba(199,111,147,.55),rgba(172,92,127,.40))",
                      color: "#f0c0d4",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    ס
                  </div>
                  <p className="truncate text-[9px] font-semibold" style={{ color: "rgba(255,255,255,0.80)" }}>
                    הסלון שלי
                  </p>
                </div>

                {/* Nav groups */}
                <nav className="flex-1 overflow-hidden px-1.5 py-2 space-y-2.5">
                  {NAV_GROUPS_PREVIEW.map((group) => (
                    <div key={group.label}>
                      <p
                        className="mb-1 px-1.5 text-[7px] font-semibold uppercase tracking-widest"
                        style={{ color: "rgba(255,255,255,0.30)" }}
                      >
                        {group.label}
                      </p>
                      <div className="space-y-0.5">
                        {group.items.map((item) => (
                          <div
                            key={item.label}
                            className="rounded-lg px-1.5 py-1 text-[8px] font-medium truncate"
                            style={
                              item.active
                                ? {
                                    background: "linear-gradient(135deg, rgba(199,111,147,0.20) 0%, rgba(172,92,127,0.13) 100%)",
                                    color: "#e0a0c0",
                                    boxShadow: "inset 0 0 0 1px rgba(172,92,127,0.28)",
                                  }
                                : { color: "rgba(255,255,255,0.45)" }
                            }
                          >
                            {item.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </nav>
              </aside>

              {/* Main content */}
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {/* Top bar */}
                <div
                  className="flex h-9 shrink-0 items-center justify-between px-2.5"
                  style={{ background: "#fff", borderBottom: "1px solid #ece4e8" }}
                >
                  <span className="text-[9px] font-bold" style={{ color: "#2b2530" }}>לוח הבקרה</span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[8px] font-medium"
                    style={{ background: "rgba(172,92,127,.10)", color: "#ac5c7f" }}
                  >
                    ✓ הכל כאן
                  </span>
                </div>

                <div className="flex-1 overflow-hidden p-2 space-y-2">

                  {/* Hero card */}
                  <div
                    className="relative overflow-hidden rounded-xl px-2.5 py-2"
                    style={{
                      background: "linear-gradient(145deg, #2b0e1f 0%, #3e1630 55%, #2c1527 100%)",
                      border: "1px solid rgba(172,92,127,0.28)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[7px]" style={{ color: "rgba(255,255,255,0.45)" }}>שלום,</p>
                        <p className="text-[11px] font-bold text-white leading-tight">הסלון שלי</p>
                      </div>
                      <div
                        className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[8px] font-bold"
                        style={{ background: "rgba(61,139,110,0.22)", border: "1px solid rgba(61,139,110,0.32)", color: "#7ee8b8" }}
                      >
                        <span>₪4,200</span>
                        <span className="text-[7px] font-normal opacity-65">החודש</span>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <div
                        className="flex items-center gap-1 rounded-lg px-1.5 py-0.5"
                        style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.12)" }}
                      >
                        <span className="text-[7px] font-bold text-white">6</span>
                        <span className="text-[7px]" style={{ color: "rgba(255,255,255,0.55)" }}>פגישות היום</span>
                      </div>
                      <div
                        className="flex items-center gap-1 rounded-lg px-1.5 py-0.5"
                        style={{ background: "rgba(212,168,30,0.18)", border: "1px solid rgba(212,168,30,0.32)" }}
                      >
                        <span className="text-[7px] font-bold" style={{ color: "#f5e090" }}>2</span>
                        <span className="text-[7px]" style={{ color: "rgba(245,224,144,0.75)" }}>ממתינות לאישור</span>
                      </div>
                      <div
                        className="flex items-center gap-1 rounded-lg px-1.5 py-0.5"
                        style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.12)" }}
                      >
                        <span className="text-[7px] font-bold text-white">84</span>
                        <span className="text-[7px]" style={{ color: "rgba(255,255,255,0.55)" }}>לקוחות</span>
                      </div>
                    </div>
                  </div>

                  {/* Metric cards — 2x2 */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {METRICS_PREVIEW.map((m) => (
                      <div
                        key={m.label}
                        className="rounded-xl p-1.5"
                        style={
                          m.accent
                            ? {
                                background: "linear-gradient(135deg, #fdf0f7 0%, #f5e8f2 100%)",
                                border: "1px solid rgba(172,92,127,0.20)",
                              }
                            : {
                                background: "#fff",
                                border: "1px solid #ece4e8",
                              }
                        }
                      >
                        <p className="text-[7px]" style={{ color: "#8a8190" }}>{m.label}</p>
                        <p
                          className="mt-0.5 text-[11px] font-bold tabular-nums"
                          style={{ color: m.accent ? "#ac5c7f" : "#2b2530" }}
                        >
                          {m.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Appointments list */}
                  <div
                    className="overflow-hidden rounded-xl"
                    style={{ background: "#fff", border: "1px solid #ece4e8" }}
                  >
                    <div className="px-2 py-1.5" style={{ borderBottom: "1px solid #f5f0f3" }}>
                      <span className="text-[8px] font-semibold" style={{ color: "#2b2530" }}>הפגישות שלך להיום</span>
                    </div>
                    {BOOKINGS_PREVIEW.map((item, i) => (
                      <div
                        key={item.name}
                        className="flex items-center gap-1.5 px-2 py-1.5"
                        style={i > 0 ? { borderTop: "1px solid #f5f0f3" } : undefined}
                      >
                        <span
                          className="w-7 shrink-0 text-[8px] font-bold tabular-nums"
                          style={{ color: "#ac5c7f" }}
                        >
                          {item.time}
                        </span>
                        <div
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white"
                          style={{ background: "linear-gradient(135deg, rgba(199,111,147,0.85), rgba(172,92,127,0.75))" }}
                        >
                          {item.name[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[8px] font-semibold" style={{ color: "#2b2530" }}>{item.name}</p>
                          <p className="truncate text-[7px]" style={{ color: "#8a8190" }}>{item.service}</p>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[7px] font-medium"
                          style={
                            item.approved
                              ? { background: "rgba(61,139,110,0.10)", color: "#3d8b6e" }
                              : { background: "rgba(184,150,10,0.10)", color: "#7a6400" }
                          }
                        >
                          {item.approved ? "מאושר" : "ממתין"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating reminder badge — bottom-right */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.65 }}
            className="absolute bottom-0 right-0 z-10 flex items-center gap-2 rounded-xl px-3 py-2"
            style={{
              background: "rgba(255,255,255,.08)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(255,255,255,.12)",
              boxShadow: "0 8px 24px rgba(0,0,0,.28)",
            }}
          >
            <MessageCircle className="h-4 w-4 shrink-0" style={{ color: "#e7a9c4" }} />
            <div>
              <p className="text-[9px] font-medium" style={{ color: "rgba(255,255,255,.5)" }}>תזכורת נשלחה</p>
              <p className="text-[11px] font-bold text-white">נועה לוי · מחר 10:00</p>
            </div>
          </motion.div>
        </motion.div>

        {/* Trust pills */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.5 }}
          className="mt-8 w-full max-w-md"
        >
          <div className="flex flex-wrap gap-2">
            {TRUST_POINTS_LEFT.map((point) => (
              <div
                key={point}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
                style={{
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(255,255,255,.09)",
                }}
              >
                <CheckCircle2 className="h-3 w-3 shrink-0" style={{ color: "#c76f93" }} />
                <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,.55)" }}>
                  {point}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ── exported shell ──────────────────────────────────────────────────────── */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen" dir="rtl">
      {/* Form panel — right side in RTL */}
      <FormPanel>{children}</FormPanel>
      {/* Preview panel — left side in RTL, desktop only */}
      <PreviewPanel />
    </div>
  );
}
