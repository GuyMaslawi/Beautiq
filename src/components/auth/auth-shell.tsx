"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  CalendarDays,
  Users2,
  MessageCircle,
  TrendingUp,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { BRAND } from "@/lib/constants/he";

/* ── static preview data ────────────────────────────────────────────────── */
const NAV_PREVIEW = [
  { label: "לוח הבקרה", active: true },
  { label: "תורים", active: false },
  { label: "לקוחות", active: false },
  { label: "שירותים", active: false },
  { label: "שעות פעילות", active: false },
  { label: "הגדרות", active: false },
];

const METRICS_PREVIEW = [
  { label: "תורים היום", value: "6", icon: "📅" },
  { label: "לקוחות", value: "84", icon: "👥" },
  { label: "הכנסות החודש", value: "₪4,200", icon: "💰" },
  { label: "שירותים", value: "9", icon: "✨" },
];

const UPCOMING_PREVIEW = [
  { name: "נועה לוי", service: "לק ג׳ל", time: "10:00", status: "מאושר" },
  { name: "מיה כהן", service: "עיצוב גבות", time: "11:30", status: "ממתין" },
  { name: "שירה גולן", service: "טיפול פנים", time: "13:00", status: "מאושר" },
];

const VALUE_POINTS = [
  { icon: CalendarDays, text: "ניהול תורים חכם" },
  { icon: Users2, text: "CRM לקוחות מלא" },
  { icon: MessageCircle, text: "הודעות ווצאפ מוכנות לשליחה" },
  { icon: TrendingUp, text: "תובנות עסקיות בזמן אמת" },
];

/* ── form panel ──────────────────────────────────────────────────────────── */
function FormPanel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex w-full shrink-0 flex-col justify-center bg-surface px-6 py-12 md:w-[460px] md:px-10"
    >
      <div className="mx-auto w-full max-w-[340px]">
        {/* Brand mark */}
        <Link href="/signup" className="mb-10 flex items-center gap-3 no-underline">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white text-sm font-bold"
            style={{
              background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
              boxShadow: "0 3px 10px rgba(184,107,140,0.40)",
            }}
          >
            B
          </span>
          <div>
            <span className="text-foreground block text-xl font-bold tracking-tight leading-none">
              {BRAND.name}
            </span>
            <span className="text-muted block text-xs mt-0.5">ה-CRM לעסקי יופי</span>
          </div>
        </Link>

        {children}
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
          "linear-gradient(150deg, #1e1024 0%, #2d1a28 40%, #3a2138 70%, #1a0e1e 100%)",
      }}
    >
      {/* Decorative orbs */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: "-80px",
          right: "-80px",
          width: 360,
          height: 360,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(201,120,152,0.25) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          bottom: "-60px",
          left: "-60px",
          width: 280,
          height: 280,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(192,149,96,0.18) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          top: "40%",
          left: "20%",
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(184,107,140,0.12) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <div className="relative flex flex-1 flex-col items-center justify-center px-10 py-12">
        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 w-full max-w-md"
        >
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: "#c97898" }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(201,120,152,0.8)" }}>
              פלטפורמה חכמה לעסקי יופי
            </span>
          </div>
          <h2
            className="text-3xl font-bold leading-tight text-white"
            style={{ letterSpacing: "-0.02em" }}
          >
            נהלו את העסק שלכם
            <br />
            <span style={{ color: "#c97898" }}>בצורה מקצועית</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.50)" }}>
            תורים, לקוחות, שירותים ומקדמות — במקום אחד, בעברית פשוטה.
          </p>
        </motion.div>

        {/* App mockup */}
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md overflow-hidden rounded-2xl"
          style={{
            boxShadow:
              "0 32px 80px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.30), inset 0 0 0 1px rgba(255,255,255,0.07)",
          }}
        >
          {/* Browser bar */}
          <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: "#180e1c" }}>
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: "rgba(255,90,90,0.7)" }} />
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: "rgba(255,200,50,0.7)" }} />
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: "rgba(50,215,75,0.7)" }} />
            </div>
            <div
              className="flex-1 rounded-md px-3 py-1 text-center text-xs"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.30)" }}
            >
              beautiq.co.il/dashboard
            </div>
          </div>

          {/* App shell */}
          <div className="flex" style={{ height: 290, background: "#faf7f5" }}>
            {/* Sidebar */}
            <aside
              className="flex w-36 shrink-0 flex-col"
              style={{ background: "#fff", borderLeft: "1px solid #ece4e8" }}
            >
              <div
                className="flex h-10 items-center px-3 gap-2"
                style={{ borderBottom: "1px solid #ece4e8" }}
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white text-[8px] font-bold"
                  style={{ background: "linear-gradient(135deg, #c97898, #b86b8c)" }}
                >
                  B
                </span>
                <span className="text-xs font-bold" style={{ color: "#2b2530" }}>
                  Beautiq
                </span>
              </div>
              <nav className="flex-1 space-y-0.5 p-2">
                {NAV_PREVIEW.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg px-2.5 py-1.5 text-[10px] font-medium"
                    style={
                      item.active
                        ? {
                            background: "rgba(184,107,140,0.12)",
                            color: "#b86b8c",
                          }
                        : { color: "#8a8190" }
                    }
                  >
                    {item.label}
                  </div>
                ))}
              </nav>
            </aside>

            {/* Main content */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div
                className="flex h-10 items-center justify-between px-3"
                style={{ background: "#fff", borderBottom: "1px solid #ece4e8" }}
              >
                <span className="text-[10px] font-bold" style={{ color: "#2b2530" }}>
                  לוח הבקרה
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-medium"
                  style={{ background: "rgba(184,107,140,0.10)", color: "#b86b8c" }}
                >
                  ✓ כל המידע כאן
                </span>
              </div>

              <div className="flex-1 overflow-hidden p-3 space-y-2.5">
                {/* Metric row */}
                <div className="grid grid-cols-2 gap-1.5">
                  {METRICS_PREVIEW.map((m) => (
                    <div
                      key={m.label}
                      className="rounded-xl p-2"
                      style={{ background: "#fff", border: "1px solid #ece4e8" }}
                    >
                      <p className="text-[8px]" style={{ color: "#8a8190" }}>{m.label}</p>
                      <p className="mt-0.5 text-sm font-bold" style={{ color: "#2b2530" }}>
                        {m.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Upcoming list */}
                <div
                  className="overflow-hidden rounded-xl"
                  style={{ background: "#fff", border: "1px solid #ece4e8" }}
                >
                  <div className="px-2.5 py-1.5" style={{ borderBottom: "1px solid #f5f0f3" }}>
                    <span className="text-[9px] font-semibold" style={{ color: "#2b2530" }}>
                      תורים קרובים
                    </span>
                  </div>
                  {UPCOMING_PREVIEW.map((item, i) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between px-2.5 py-1.5"
                      style={i > 0 ? { borderTop: "1px solid #f5f0f3" } : undefined}
                    >
                      <div>
                        <p className="text-[9px] font-semibold" style={{ color: "#2b2530" }}>
                          {item.name}
                        </p>
                        <p className="text-[8px]" style={{ color: "#8a8190" }}>
                          {item.service} · {item.time}
                        </p>
                      </div>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[8px] font-medium"
                        style={
                          item.status === "מאושר"
                            ? { background: "rgba(184,107,140,0.10)", color: "#b86b8c" }
                            : { background: "rgba(184,150,10,0.10)", color: "#7a6400" }
                        }
                      >
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Value points */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-8 w-full max-w-md"
        >
          <div className="grid grid-cols-2 gap-3">
            {VALUE_POINTS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "rgba(184,107,140,0.15)" }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: "#c97898" }} />
                </div>
                <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {text}
                </span>
              </div>
            ))}
          </div>

          {/* Trust line */}
          <div className="mt-5 flex items-center gap-2" style={{ color: "rgba(255,255,255,0.25)" }}>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(184,107,140,0.6)" }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              מותאם לעסקי יופי ובעברית מלאה
            </span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
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
