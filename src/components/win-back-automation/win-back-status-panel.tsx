"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Zap,
  ChevronDown,
  ChevronUp,
  Play,
  Send,
  MessageCircle,
  Shield,
  Info,
} from "lucide-react";
import { WIN_BACK_AUTOMATION } from "@/lib/constants/he";
import {
  toggleWinBackAutomation,
  triggerWinBackRun,
  sendWhatsAppTestMessage,
} from "@/server/win-back-automation/actions";
import type { AutomationSetting, WhatsAppConnection, AutomationRun } from "@prisma/client";
import type { WinBackStats, EligibilityBreakdown } from "@/server/win-back-automation/queries";

// ── Helpers ───────────────────────────────────────────────────────────────────

const HEBREW_MONTHS = [
  "ינואר","פברואר","מרץ","אפריל","מאי","יוני",
  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר",
];

function formatDate(date: Date | null): string {
  if (!date) return "עוד לא הופעלה";
  const d = new Date(date);
  return `${d.getDate()} ב${HEBREW_MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ── Readiness ─────────────────────────────────────────────────────────────────

type ReadinessState = "active" | "ready" | "no_whatsapp" | "no_template";

function computeReadiness(
  isEnabled: boolean,
  realSendEnabled: boolean,
  credentialsConfigured: boolean,
  hasTemplate: boolean,
): ReadinessState {
  if (!realSendEnabled) return isEnabled ? "active" : "ready";
  if (!credentialsConfigured) return "no_whatsapp";
  if (!hasTemplate) return "no_template";
  return isEnabled ? "active" : "ready";
}

const READINESS_CONFIG: Record<
  ReadinessState,
  { label: string; color: string; bg: string; border: string; Icon: React.ElementType }
> = {
  active: {
    label: "השליחה האוטומטית פעילה",
    color: "#15803d",
    bg: "rgba(22,163,74,0.08)",
    border: "rgba(22,163,74,0.18)",
    Icon: CheckCircle2,
  },
  ready: {
    label: "המערכת מוכנה לשליחה",
    color: "#b86b8c",
    bg: "rgba(184,107,140,0.08)",
    border: "rgba(184,107,140,0.18)",
    Icon: CheckCircle2,
  },
  no_whatsapp: {
    label: "נדרש חיבור WhatsApp",
    color: "#7a5800",
    bg: "rgba(184,150,10,0.08)",
    border: "rgba(184,150,10,0.20)",
    Icon: AlertCircle,
  },
  no_template: {
    label: "נדרשת תבנית הודעה מאושרת",
    color: "#7a5800",
    bg: "rgba(184,150,10,0.08)",
    border: "rgba(184,150,10,0.20)",
    Icon: AlertCircle,
  },
};

// ── BreakdownPanel ────────────────────────────────────────────────────────────

function BreakdownPanel({ breakdown }: { breakdown: EligibilityBreakdown }) {
  const bd = WIN_BACK_AUTOMATION.breakdown;
  const skipReasons: Array<{ label: string; count: number }> = [
    { label: bd.noCompletedBooking, count: breakdown.noCompletedBooking },
    { label: bd.hasFutureBooking, count: breakdown.hasFutureBooking },
    { label: bd.noOptIn, count: breakdown.noOptIn },
    { label: bd.invalidPhone, count: breakdown.invalidPhone },
    { label: bd.inCooldown, count: breakdown.inCooldown },
  ].filter((r) => r.count > 0);

  return (
    <div className="space-y-2 text-xs" style={{ color: "var(--muted)" }}>
      <div className="flex items-center justify-between">
        <span>{bd.total}</span>
        <span className="font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
          {breakdown.total}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span style={{ color: "#16a34a", fontWeight: 600 }}>{bd.eligible}</span>
        <span className="font-bold tabular-nums" style={{ color: "#16a34a" }}>
          {breakdown.eligible}
        </span>
      </div>
      {skipReasons.length > 0 && (
        <>
          <div className="pt-0.5 font-semibold">{bd.skippedHeader}</div>
          {skipReasons.map((r) => (
            <div key={r.label} className="flex items-center justify-between ps-2">
              <span>· {r.label}</span>
              <span className="tabular-nums">{r.count}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  setting: AutomationSetting | null;
  connection: WhatsAppConnection | null;
  lastRun: AutomationRun | null;
  stats: WinBackStats;
  eligibleCount: number;
  breakdown: EligibilityBreakdown | null;
  realSendEnabled: boolean;
  credentialsConfigured: boolean;
  testModeActive: boolean;
  testPhoneConfigured: boolean;
  sandboxTestPassed: boolean;
  hasRealBusinessPhone: boolean;
}

export function WinBackStatusPanel(props: Props) {
  const {
    setting,
    connection,
    lastRun,
    stats,
    eligibleCount,
    breakdown,
    realSendEnabled,
    credentialsConfigured,
    testModeActive,
    testPhoneConfigured,
  } = props;

  const [isToggling, startToggle] = useTransition();
  const [isRunning, startRun] = useTransition();
  const [isTesting, startTest] = useTransition();
  const [runResult, setRunResult] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showRunConfirm, setShowRunConfirm] = useState(false);

  const isEnabled = setting?.enabled ?? false;
  const hasTemplate = !!setting?.templateName;
  const readiness = computeReadiness(isEnabled, realSendEnabled, credentialsConfigured, hasTemplate);
  const { Icon: ReadinessIcon, ...readinessCfg } = READINESS_CONFIG[readiness];
  const canTestSend = realSendEnabled && credentialsConfigured && testModeActive && testPhoneConfigured;

  const handleToggle = () => {
    startToggle(async () => {
      await toggleWinBackAutomation(!isEnabled);
    });
  };

  const handleRunConfirm = () => {
    setShowRunConfirm(false);
    setRunResult(null);
    startRun(async () => {
      const result = await triggerWinBackRun();
      if (result.success) {
        setRunResult(
          result.mockSkipCount > 0
            ? `הסתיים — ${result.mockSkipCount} הרצות בדיקה (לא נשלח בפועל)`
            : `הסתיים — ${result.sentCount} נשלחו, ${result.skippedCount} דולגו`,
        );
      } else {
        setRunResult(result.error ?? "הריצה נכשלה. יש לנסות שוב.");
      }
      setTimeout(() => setRunResult(null), 8000);
    });
  };

  const handleTestSend = () => {
    setTestResult(null);
    startTest(async () => {
      const result = await sendWhatsAppTestMessage();
      setTestResult(
        result.success
          ? `✓ הודעת בדיקה נשלחה${result.providerMessageId ? ` — ${result.providerMessageId}` : ""}`
          : `✗ ${result.error ?? "שגיאה בשליחה"}`,
      );
      setTimeout(() => setTestResult(null), 8000);
    });
  };

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="space-y-5 p-5 sm:p-6">

        {/* ── HERO ── */}
        <div>
          <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
            החזרת לקוחות אוטומטית
          </h2>
          <p className="mt-1.5 text-sm leading-6" style={{ color: "var(--muted)" }}>
            Allura מזהה לקוחות שלא חזרו ושולחת להם הודעת WhatsApp אישית כדי לעזור לך למלא את היומן.
          </p>
        </div>

        {/* ── KPI ── */}
        <div
          className="flex items-baseline gap-3 rounded-2xl px-5 py-4"
          style={{ background: "rgba(184,107,140,0.08)" }}
        >
          <span
            className="text-4xl font-bold tabular-nums leading-none"
            style={{ color: "#b86b8c" }}
          >
            {eligibleCount}
          </span>
          <span className="text-base font-semibold" style={{ color: "#b86b8c" }}>
            לקוחות להחזרה
          </span>
        </div>

        {/* ── Enable / Disable CTA ── */}
        {!isEnabled ? (
          <button
            type="button"
            disabled={isToggling}
            onClick={handleToggle}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)" }}
          >
            <Zap className="h-5 w-5" />
            {isToggling ? "מפעיל…" : "הפעלת החזרת לקוחות"}
          </button>
        ) : (
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3.5"
            style={{
              background: "rgba(22,163,74,0.06)",
              border: "1px solid rgba(22,163,74,0.18)",
            }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" style={{ color: "#16a34a" }} />
              <span className="text-base font-bold" style={{ color: "#15803d" }}>
                החזרת לקוחות פעילה
              </span>
            </div>
            <button
              type="button"
              disabled={isToggling}
              onClick={handleToggle}
              className="text-sm transition-opacity hover:opacity-70 disabled:opacity-50"
              style={{ color: "var(--muted)" }}
            >
              {isToggling ? "מכבה…" : "כיבוי"}
            </button>
          </div>
        )}

        {/* ── Collapsible: הגדרות מתקדמות ── */}
        <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-xs"
            style={{ background: "var(--background-alt)" }}
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <span
              className="flex items-center gap-2 font-semibold"
              style={{ color: "var(--muted)" }}
            >
              <Shield className="h-3.5 w-3.5" />
              הגדרות מתקדמות
            </span>
            {showAdvanced ? (
              <ChevronUp className="h-3.5 w-3.5" style={{ color: "var(--muted)" }} />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--muted)" }} />
            )}
          </button>

          {showAdvanced && (
            <div
              className="space-y-4 px-4 py-4"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              {/* Readiness */}
              <div
                className="flex items-center gap-2.5 rounded-xl px-4 py-2.5"
                style={{ background: readinessCfg.bg, border: `1px solid ${readinessCfg.border}` }}
              >
                <ReadinessIcon className="h-4 w-4 shrink-0" style={{ color: readinessCfg.color }} />
                <span className="text-sm font-medium" style={{ color: readinessCfg.color }}>
                  {readinessCfg.label}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2.5">
                <div
                  className="flex flex-col items-center gap-1 rounded-xl px-3 py-3"
                  style={{ background: "rgba(59,122,181,0.08)" }}
                >
                  <span className="text-xl font-bold tabular-nums leading-none" style={{ color: "#3b7ab5" }}>
                    {stats.realSentThisMonth}
                  </span>
                  <span className="text-center text-xs leading-tight" style={{ color: "#3b7ab5", opacity: 0.75 }}>
                    הודעות שנשלחו החודש
                  </span>
                </div>
                <div
                  className="flex flex-col items-center gap-1 rounded-xl px-3 py-3"
                  style={{ background: "rgba(107,114,128,0.08)" }}
                >
                  <span className="text-xl font-bold tabular-nums leading-none" style={{ color: "#6b7280" }}>
                    —
                  </span>
                  <span className="text-center text-xs leading-tight" style={{ color: "#6b7280", opacity: 0.75 }}>
                    תורים שחזרו
                  </span>
                </div>
              </div>

              {/* Zero eligible note */}
              {isEnabled && eligibleCount === 0 && breakdown && (
                <div
                  className="flex items-start gap-2.5 rounded-xl px-4 py-3"
                  style={{
                    background: "rgba(184,150,10,0.06)",
                    border: "1px solid rgba(184,150,10,0.16)",
                  }}
                >
                  <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#c09040" }} />
                  <p className="text-sm" style={{ color: "#7a5800" }}>
                    {"אין לקוחות שמחכות להודעה כרגע."}
                    {setting?.requireOptIn && breakdown.noOptIn > 0
                      ? " ניתן להוסיף אישור קבלת הודעות בפרופיל הלקוחה."
                      : ""}
                  </p>
                </div>
              )}

              {/* Connection details */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-1.5 pb-1">
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--muted)" }} />
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                    חיבור WhatsApp
                  </span>
                </div>
                <div className="space-y-1.5 ps-5" style={{ color: "var(--muted)" }}>
                  <div className="flex justify-between">
                    <span>ספק</span>
                    <span dir="ltr" className="font-mono">
                      {connection?.provider ?? (realSendEnabled ? "meta_cloud_api" : "dev_mock")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>שליחה אמיתית</span>
                    <span style={{ color: realSendEnabled ? "#16a34a" : "var(--muted)" }}>
                      {realSendEnabled ? "מופעלת" : "כבויה"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>מצב בדיקה</span>
                    <span style={{ color: testModeActive ? "#c09040" : "var(--muted)" }}>
                      {testModeActive ? "פעיל" : "כבוי"}
                    </span>
                  </div>
                  {credentialsConfigured && (
                    <div className="flex justify-between">
                      <span>אישורי Meta</span>
                      <span style={{ color: "#16a34a" }}>מוגדרים</span>
                    </div>
                  )}
                  {connection?.phoneNumber && (
                    <div className="flex justify-between">
                      <span>מספר טלפון</span>
                      <span dir="ltr">{connection.phoneNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Template info */}
              {setting?.templateName && (
                <div className="space-y-1.5 text-xs">
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                    תבנית WhatsApp
                  </span>
                  <div className="space-y-1 ps-2" style={{ color: "var(--muted)" }}>
                    <div className="flex justify-between">
                      <span>שם תבנית</span>
                      <span dir="ltr" className="font-mono">
                        {setting.templateName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>שפה</span>
                      <span dir="ltr" className="font-mono">
                        {setting.templateLanguage ?? "he"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Mock runs note */}
              {stats.mockRunsThisMonth > 0 && (
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: "rgba(184,150,10,0.06)",
                    border: "1px solid rgba(184,150,10,0.16)",
                  }}
                >
                  <span style={{ color: "#7a5800" }}>
                    ⚠ {stats.mockRunsThisMonth} הרצות בדיקה החודש — לא נשלח בפועל
                  </span>
                </div>
              )}

              {/* Last run */}
              <div className="space-y-1.5 text-xs">
                <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                  ריצה אחרונה
                </span>
                <div className="ps-2" style={{ color: "var(--muted)" }}>
                  <span>{formatDate(lastRun?.startedAt ?? null)}</span>
                  {lastRun && (
                    <div className="mt-1 flex flex-wrap gap-3">
                      {lastRun.sentCount > 0 && (
                        <span style={{ color: "#16a34a" }}>✓ {lastRun.sentCount} נשלחו</span>
                      )}
                      {lastRun.skippedCount > 0 && (
                        <span>⟳ {lastRun.skippedCount} דולגו</span>
                      )}
                      {lastRun.failedCount > 0 && (
                        <span style={{ color: "#dc2626" }}>✗ {lastRun.failedCount} נכשלו</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Eligibility breakdown */}
              {breakdown && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                    {WIN_BACK_AUTOMATION.breakdown.title}
                  </span>
                  <BreakdownPanel breakdown={breakdown} />
                </div>
              )}

              {/* Run Now */}
              {isEnabled && (
                <div className="space-y-2">
                  {!showRunConfirm ? (
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => setShowRunConfirm(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      style={{
                        background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
                      }}
                    >
                      <Play className="h-3.5 w-3.5" />
                      {isRunning ? "מריץ…" : "הפעלה ידנית עכשיו"}
                    </button>
                  ) : (
                    <div
                      className="space-y-2 rounded-lg px-3 py-3"
                      style={{
                        background: "rgba(59,122,181,0.05)",
                        border: "1px solid rgba(59,122,181,0.16)",
                      }}
                    >
                      <p className="text-xs font-semibold" style={{ color: "#1e4d7a" }}>
                        אישור הרצת בדיקה
                      </p>
                      <p className="text-xs" style={{ color: "#2b5c8f" }}>
                        המערכת תבדוק לקוחות מתאימות ותשלח לפי ההגדרות.
                      </p>
                      <div className="flex gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={handleRunConfirm}
                          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                          style={{
                            background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
                          }}
                        >
                          <Play className="h-3 w-3" />
                          אישור
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRunConfirm(false)}
                          className="rounded-md px-3 py-1.5 text-xs"
                          style={{
                            background: "var(--background)",
                            color: "var(--muted)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          ביטול
                        </button>
                      </div>
                    </div>
                  )}
                  {runResult && (
                    <p
                      className="rounded-lg px-3 py-2 text-center text-xs font-medium"
                      style={{
                        background: runResult.includes("נכשל")
                          ? "rgba(220,38,38,0.07)"
                          : "rgba(22,163,74,0.07)",
                        color: runResult.includes("נכשל") ? "#dc2626" : "#15803d",
                        border: `1px solid ${runResult.includes("נכשל") ? "rgba(220,38,38,0.18)" : "rgba(22,163,74,0.18)"}`,
                      }}
                    >
                      {runResult}
                    </p>
                  )}
                </div>
              )}

              {/* Test send */}
              {canTestSend && (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    disabled={isTesting}
                    onClick={handleTestSend}
                    className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    style={{
                      background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                    }}
                  >
                    <Send className="h-3.5 w-3.5" />
                    {isTesting ? "שולח…" : "שליחת בדיקה למספר שלי"}
                  </button>
                  <p className="text-center text-[11px]" style={{ color: "var(--muted)" }}>
                    ההודעה תישלח רק אל מספר הבדיקה שהוגדר — לא ללקוחות
                  </p>
                  {testResult && (
                    <p
                      className="rounded-lg px-3 py-2 text-center text-xs font-medium"
                      style={{
                        background: testResult.startsWith("✓")
                          ? "rgba(22,163,74,0.07)"
                          : "rgba(220,38,38,0.07)",
                        color: testResult.startsWith("✓") ? "#15803d" : "#dc2626",
                        border: `1px solid ${testResult.startsWith("✓") ? "rgba(22,163,74,0.18)" : "rgba(220,38,38,0.18)"}`,
                      }}
                    >
                      {testResult}
                    </p>
                  )}
                </div>
              )}

              <p className="text-center text-[11px]" style={{ color: "var(--muted)" }}>
                שליחה ידנית זמינה תמיד
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export type { Props as WinBackStatusPanelProps };
