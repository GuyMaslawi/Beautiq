"use client";

import { useState, useTransition } from "react";
import {
  Zap,
  ZapOff,
  MessageCircle,
  AlertCircle,
  Play,
  CheckCircle2,
  Clock,
  Users2,
  Send,
  Info,
  ShieldAlert,
  FileCheck,
} from "lucide-react";
import { WIN_BACK_AUTOMATION } from "@/lib/constants/he";
import { triggerWinBackRun } from "@/server/win-back-automation/actions";
import type { AutomationSetting, WhatsAppConnection, AutomationRun } from "@prisma/client";
import type { WinBackStats, EligibilityBreakdown } from "@/server/win-back-automation/queries";

const c = WIN_BACK_AUTOMATION.statusPanel;
const conn = WIN_BACK_AUTOMATION.connectionSection;
const rc = WIN_BACK_AUTOMATION.runConfirm;
const bd = WIN_BACK_AUTOMATION.breakdown;
const ze = WIN_BACK_AUTOMATION.zeroEligible;

// ── helpers ────────────────────────────────────────────────────────────────────

const HEBREW_MONTHS = [
  "ינואר","פברואר","מרץ","אפריל","מאי","יוני",
  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר",
];

function formatDate(date: Date | null): string {
  if (!date) return c.neverRun;
  const d = new Date(date);
  return `${d.getDate()} ב${HEBREW_MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ── Connection badge ────────────────────────────────────────────────────────────

interface ConnectionBadgeProps {
  connection: WhatsAppConnection | null;
  realSendEnabled: boolean;
  credentialsConfigured: boolean;
  hasTemplate: boolean;
  testModeActive: boolean;
  testPhoneConfigured: boolean;
  sandboxTestPassed: boolean;
  hasRealBusinessPhone: boolean;
}

function ConnectionBadge({
  connection,
  realSendEnabled,
  credentialsConfigured,
  hasTemplate,
  testModeActive,
  testPhoneConfigured,
  sandboxTestPassed,
  hasRealBusinessPhone,
}: ConnectionBadgeProps) {
  // Connection error state (DB record)
  if (connection?.status === "error") {
    return (
      <StatusBox
        color="#dc2626"
        bg="rgba(220,38,38,0.05)"
        border="rgba(220,38,38,0.18)"
        icon={<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#dc2626" }} />}
        title={conn.connectionErrorBadge}
        body={conn.notConnectedBody}
      />
    );
  }

  // Dev mode — real sending is off
  if (!realSendEnabled) {
    return (
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3"
        style={{
          background: "rgba(184,150,10,0.06)",
          border: "1px solid rgba(184,150,10,0.20)",
        }}
      >
        <div className="flex items-center gap-3">
          <MessageCircle className="h-4 w-4 shrink-0" style={{ color: "#c09040" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#7a5800" }}>
              {conn.devModeBadge}
            </p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {conn.devModeNote}
            </p>
          </div>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: "rgba(184,150,10,0.12)", color: "#7a5800" }}
        >
          DEV
        </span>
      </div>
    );
  }

  // Real send enabled — test mode active, no test phone configured
  if (testModeActive && !testPhoneConfigured) {
    return (
      <StatusBox
        color="#dc2626"
        bg="rgba(220,38,38,0.05)"
        border="rgba(220,38,38,0.18)"
        icon={<ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#dc2626" }} />}
        title={conn.testModeNoPhoneBadge}
        body={conn.testModeNoPhoneBody}
      />
    );
  }

  // Real send enabled — Meta credentials configured → show rich multi-status list
  if (realSendEnabled && credentialsConfigured) {
    const statusItems: Array<{
      ok: boolean;
      warning?: boolean;
      label: string;
      sublabel?: string;
    }> = [
      { ok: true, label: "Meta Cloud API מחובר" },
      {
        ok: true,
        warning: true,
        label: testModeActive ? "מצב בדיקה פעיל" : "מצב ייצור",
        sublabel: testModeActive
          ? "שליחה מותרת רק למספר הבדיקה"
          : "שליחה לכל לקוחות מתאימות",
      },
      {
        ok: sandboxTestPassed,
        label: sandboxTestPassed
          ? "שליחת בדיקה עברה בהצלחה"
          : "ממתין לשליחת בדיקה ראשונה",
      },
      {
        ok: hasRealBusinessPhone,
        label: hasRealBusinessPhone
          ? "מספר עסקי רשום ב-Meta"
          : "ממתין לרישום מספר טלפון עסקי",
      },
      {
        ok: hasTemplate,
        label: hasTemplate
          ? "תבנית עברית מאושרת מוגדרת"
          : "ממתין לאישור תבנית עברית",
      },
      {
        ok: false,
        label: "שליחה לייצור מושבתת בשלב זה",
        sublabel: "תופעל לאחר השלמת כל ההגדרות",
      },
    ];

    return (
      <div
        className="rounded-xl px-4 py-3.5 space-y-2.5"
        style={{
          background: "rgba(59,122,181,0.04)",
          border: "1px solid rgba(59,122,181,0.18)",
        }}
      >
        <div className="flex items-center gap-2 pb-1" style={{ borderBottom: "1px solid var(--border)" }}>
          <MessageCircle className="h-3.5 w-3.5 shrink-0" style={{ color: "#3b7ab5" }} />
          <span className="text-xs font-semibold" style={{ color: "#2a5a8a" }}>
            סטטוס WhatsApp
          </span>
          <span
            className="me-auto rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: "rgba(234,179,8,0.15)", color: "#854d0e" }}
          >
            TEST
          </span>
        </div>
        {statusItems.map((item) => (
          <div key={item.label} className="flex items-start gap-2.5">
            {item.ok && !item.warning ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "#16a34a" }} />
            ) : item.ok && item.warning ? (
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "#a16207" }} />
            ) : (
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "#9ca3af" }} />
            )}
            <div className="min-w-0 flex-1">
              <p
                className="text-xs font-medium leading-5"
                style={{
                  color: item.ok && !item.warning
                    ? "#15803d"
                    : item.ok && item.warning
                    ? "#854d0e"
                    : "var(--muted)",
                }}
              >
                {item.label}
              </p>
              {item.sublabel && (
                <p className="text-[11px]" style={{ color: "var(--muted)", opacity: 0.8 }}>
                  {item.sublabel}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Real send enabled but credentials missing
  if (!credentialsConfigured) {
    return (
      <StatusBox
        color="#dc2626"
        bg="rgba(220,38,38,0.05)"
        border="rgba(220,38,38,0.18)"
        icon={<ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#dc2626" }} />}
        title={conn.credentialsMissingBadge}
        body={conn.credentialsMissingBody}
      />
    );
  }

  // Real send enabled, credentials present but template missing
  if (!hasTemplate) {
    return (
      <StatusBox
        color="#c07010"
        bg="rgba(192,112,16,0.05)"
        border="rgba(192,112,16,0.20)"
        icon={<FileCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#c07010" }} />}
        title={conn.missingTemplateBadge}
        body={conn.missingTemplateBody}
      />
    );
  }

  // No connection DB record
  if (!connection || connection.status === "not_connected") {
    return (
      <StatusBox
        color="#dc2626"
        bg="rgba(220,38,38,0.05)"
        border="rgba(220,38,38,0.18)"
        icon={<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#dc2626" }} />}
        title={conn.notConnected}
        body={conn.notConnectedBody}
        cta={conn.connectCta}
      />
    );
  }

  // Fully connected for real sending
  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{
        background: "rgba(22,163,74,0.06)",
        border: "1px solid rgba(22,163,74,0.18)",
      }}
    >
      <div className="flex items-center gap-3">
        <MessageCircle className="h-4 w-4 shrink-0" style={{ color: "#16a34a" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "#15803d" }}>
            {conn.realSendConnectedBadge}
          </p>
          {connection.phoneNumber && (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {connection.phoneNumber}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBox({
  color,
  bg,
  border,
  icon,
  title,
  body,
  cta,
}: {
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  cta?: string;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3.5"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color }}>
          {title}
        </p>
        <p className="mt-0.5 text-xs leading-5" style={{ color }}>
          {body}
        </p>
        {cta && (
          <button
            disabled
            className="mt-2.5 rounded-lg px-3 py-1.5 text-xs font-semibold opacity-50 cursor-not-allowed"
            style={{ background: "#f3f4f6", color: "#555", border: "1px solid #e5e7eb" }}
          >
            {cta}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Eligibility breakdown ───────────────────────────────────────────────────────

function BreakdownPanel({ breakdown }: { breakdown: EligibilityBreakdown }) {
  const [open, setOpen] = useState(true);

  const skipReasons: Array<{ label: string; count: number }> = [
    { label: bd.noCompletedBooking, count: breakdown.noCompletedBooking },
    { label: bd.hasFutureBooking, count: breakdown.hasFutureBooking },
    { label: bd.noOptIn, count: breakdown.noOptIn },
    { label: bd.invalidPhone, count: breakdown.invalidPhone },
    { label: bd.inCooldown, count: breakdown.inCooldown },
  ].filter((r) => r.count > 0);

  return (
    <div
      className="rounded-xl"
      style={{ background: "var(--background-alt)", border: "1px solid var(--border)" }}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-xs"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2" style={{ color: "var(--muted)" }}>
          <Info className="h-3.5 w-3.5" />
          {bd.title}
        </span>
        <span style={{ color: "var(--muted)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          className="space-y-2 border-t px-4 pb-4 pt-3 text-xs"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>{bd.total}</span>
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
              <div className="pt-1" style={{ color: "var(--muted)", fontWeight: 600 }}>
                {bd.skippedHeader}
              </div>
              {skipReasons.map((r) => (
                <div key={r.label} className="flex items-center justify-between ps-2">
                  <span style={{ color: "var(--muted)" }}>· {r.label}</span>
                  <span className="tabular-nums" style={{ color: "var(--foreground-soft)" }}>
                    {r.count}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Zero eligible explanation ───────────────────────────────────────────────────

function ZeroEligibleNote({
  breakdown,
  requireOptIn,
}: {
  breakdown: EligibilityBreakdown;
  requireOptIn: boolean;
}) {
  const isOptInIssue = requireOptIn && breakdown.noOptIn > 0 && breakdown.eligible === 0;

  return (
    <div
      className="rounded-xl px-4 py-3.5"
      style={{
        background: "rgba(184,150,10,0.05)",
        border: "1px solid rgba(184,150,10,0.18)",
      }}
    >
      <p className="text-sm font-semibold" style={{ color: "#7a5800" }}>
        {ze.title}
      </p>
      <p className="mt-1 text-xs leading-5" style={{ color: "#92681a" }}>
        {isOptInIssue ? ze.noOptInReason : ""}
      </p>
      <p className="mt-0.5 text-xs leading-5" style={{ color: "#92681a" }}>
        {ze.noOptInHelper}
      </p>
    </div>
  );
}

// ── Confirmation overlay ────────────────────────────────────────────────────────

type ConfirmMode = "dev" | "test" | "real";

function ConfirmRunOverlay({
  mode,
  onConfirm,
  onCancel,
}: {
  mode: ConfirmMode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isReal = mode === "real";
  const isTest = mode === "test";

  const title = isReal ? rc.realSendTitle : isTest ? rc.testModeTitle : rc.title;
  const body = isReal ? rc.realSendBody : isTest ? rc.testModeBody : rc.body;
  const confirmLabel = isReal ? rc.realSendConfirm : isTest ? rc.testModeConfirm : rc.confirm;

  const accentBg = isReal
    ? "rgba(220,38,38,0.05)"
    : isTest
    ? "rgba(234,179,8,0.07)"
    : "rgba(59,122,181,0.05)";
  const accentBorder = isReal
    ? "rgba(220,38,38,0.20)"
    : isTest
    ? "rgba(234,179,8,0.30)"
    : "rgba(59,122,181,0.20)";
  const textColor = isReal ? "#991b1b" : isTest ? "#854d0e" : "#1e4d7a";
  const bodyColor = isReal ? "#b91c1c" : isTest ? "#a16207" : "#2b5c8f";
  const btnBg = isReal
    ? "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)"
    : isTest
    ? "linear-gradient(135deg, #ca8a04 0%, #a16207 100%)"
    : "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)";

  return (
    <div
      className="rounded-xl px-4 py-4 space-y-3"
      style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
    >
      <p className="text-sm font-semibold" style={{ color: textColor }}>
        {title}
      </p>
      <p className="text-xs leading-5" style={{ color: bodyColor }}>
        {body}
      </p>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onConfirm}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: btnBg }}
        >
          <Play className="h-3 w-3" />
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-medium"
          style={{
            background: "var(--background-alt)",
            color: "var(--muted)",
            border: "1px solid var(--border)",
          }}
        >
          {rc.cancel}
        </button>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────────

interface Props {
  setting: AutomationSetting | null;
  connection: WhatsAppConnection | null;
  lastRun: AutomationRun | null;
  stats: WinBackStats;
  eligibleCount: number;
  breakdown: EligibilityBreakdown | null;
  /** True when ENABLE_REAL_WHATSAPP_SEND=true (server-computed) */
  realSendEnabled: boolean;
  /** True when Meta credentials are present in env (server-computed) */
  credentialsConfigured: boolean;
  /** True when WHATSAPP_TEST_MODE=true (server-computed) */
  testModeActive: boolean;
  /** True when WHATSAPP_TEST_PHONE is set (server-computed) */
  testPhoneConfigured: boolean;
  /** True when a sandbox test send was confirmed */
  sandboxTestPassed: boolean;
  /** True when META_WHATSAPP_PHONE_NUMBER_ID is configured */
  hasRealBusinessPhone: boolean;
}

export function WinBackStatusPanel({
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
  sandboxTestPassed,
  hasRealBusinessPhone,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [runResult, setRunResult] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const isEnabled = setting?.enabled ?? false;
  const hasProvider = connection?.status === "active" || !realSendEnabled || credentialsConfigured;
  const hasTemplate = !!setting?.templateName;

  // Real send is active only when env + credentials + template all line up
  const isRealSend = realSendEnabled && credentialsConfigured && hasTemplate;
  // Test mode: real send enabled, test mode flag on, test phone configured
  const isTestModeSend = isRealSend && testModeActive && testPhoneConfigured;
  // Full production: real send ready AND test mode is off
  const isProductionSend = isRealSend && !testModeActive;

  const confirmMode: ConfirmMode = isProductionSend ? "real" : isTestModeSend ? "test" : "dev";

  const handleRunClick = () => {
    setRunResult(null);
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    startTransition(async () => {
      const result = await triggerWinBackRun();
      if (result.success) {
        if (result.mockSkipCount > 0) {
          setRunResult(
            `הסתיים — ${result.mockSkipCount} הרצות בדיקה (לא נשלח בפועל), ${result.skippedCount - result.mockSkipCount} דולגו`,
          );
        } else {
          setRunResult(c.runSuccess(result.sentCount, result.skippedCount));
        }
      } else {
        setRunResult(result.error ?? c.runFailed);
      }
      setTimeout(() => setRunResult(null), 8000);
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
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
            {c.title}
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>
            {c.subtitle}
          </p>
        </div>

        {/* Status badge */}
        <span
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
          style={
            isEnabled && hasProvider
              ? { background: "rgba(22,163,74,0.10)", color: "#15803d", border: "1px solid rgba(22,163,74,0.20)" }
              : !hasProvider
              ? { background: "rgba(220,38,38,0.08)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.18)" }
              : { background: "var(--background-alt)", color: "var(--muted)", border: "1px solid var(--border)" }
          }
        >
          {isEnabled && hasProvider ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
          {isEnabled && hasProvider ? c.enabled : !hasProvider ? c.noProvider : c.disabled}
        </span>
      </div>

      <div className="space-y-4 p-5">
        {/* Connection badge */}
        <ConnectionBadge
          connection={connection}
          realSendEnabled={realSendEnabled}
          credentialsConfigured={credentialsConfigured}
          hasTemplate={hasTemplate}
          testModeActive={testModeActive}
          testPhoneConfigured={testPhoneConfigured}
          sandboxTestPassed={sandboxTestPassed}
          hasRealBusinessPhone={hasRealBusinessPhone}
        />

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatChip
            icon={<Users2 className="h-3.5 w-3.5" />}
            value={String(eligibleCount)}
            label={c.eligibleNow(eligibleCount)}
            color="#b86b8c"
            bg="rgba(184,107,140,0.08)"
          />
          <StatChip
            icon={<Send className="h-3.5 w-3.5" />}
            value={String(stats.realSentThisMonth)}
            label={c.sentThisMonth(stats.realSentThisMonth)}
            color="#3b7ab5"
            bg="rgba(59,122,181,0.08)"
          />
          <StatChip
            icon={<Clock className="h-3.5 w-3.5" />}
            value={setting ? `${setting.sendHour}:00` : "—"}
            label={setting ? c.nextSend(setting.sendHour) : "—"}
            color="#6b7280"
            bg="rgba(107,114,128,0.08)"
          />
          <StatChip
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            value={setting ? c.threshold(setting.thresholdDays) : "—"}
            label={c.lastRun}
            color="#6b7280"
            bg="rgba(107,114,128,0.08)"
          />
        </div>

        {/* Mock run stats — only show when there are mock runs */}
        {stats.mockRunsThisMonth > 0 && (
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs"
            style={{
              background: "rgba(184,150,10,0.06)",
              border: "1px solid rgba(184,150,10,0.16)",
            }}
          >
            <span style={{ color: "#7a5800" }}>⚠</span>
            <span style={{ color: "#7a5800" }}>
              {stats.mockRunsThisMonth} הרצות בדיקה החודש — לא נשלח בפועל
            </span>
          </div>
        )}

        {/* Last run */}
        <div
          className="rounded-xl px-4 py-3"
          style={{ background: "var(--background-alt)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: "var(--muted)" }}>{c.lastRun}</span>
            <span className="font-medium" style={{ color: "var(--foreground)" }}>
              {formatDate(lastRun?.startedAt ?? null)}
            </span>
          </div>
          {lastRun && (
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--muted)" }}>
              {lastRun.sentCount > 0 && (
                <span style={{ color: "#16a34a" }}>✓ {lastRun.sentCount} נשלחו בפועל</span>
              )}
              {lastRun.skippedCount > 0 && (
                <span style={{ color: "#7a5800" }}>⟳ {lastRun.skippedCount} דולגו / בדיקה</span>
              )}
              {lastRun.failedCount > 0 && (
                <span style={{ color: "#dc2626" }}>✗ {lastRun.failedCount} נכשלו</span>
              )}
            </div>
          )}
        </div>

        {/* Zero eligible explanation */}
        {isEnabled && eligibleCount === 0 && breakdown && (
          <ZeroEligibleNote
            breakdown={breakdown}
            requireOptIn={setting?.requireOptIn ?? true}
          />
        )}

        {/* Eligibility breakdown */}
        {breakdown && (
          <BreakdownPanel breakdown={breakdown} />
        )}

        {/* Run now — show confirmation or button */}
        {isEnabled && !showConfirm && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleRunClick}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{
              background: isProductionSend
                ? "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)"
                : isTestModeSend
                ? "linear-gradient(135deg, #ca8a04 0%, #a16207 100%)"
                : "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
            }}
          >
            <Play className="h-4 w-4" />
            {isPending
              ? c.running
              : isProductionSend
              ? rc.runRealLabel
              : isTestModeSend
              ? rc.testModeRunLabel
              : rc.runTestLabel}
          </button>
        )}

        {isEnabled && showConfirm && (
          <ConfirmRunOverlay
            mode={confirmMode}
            onConfirm={handleConfirm}
            onCancel={() => setShowConfirm(false)}
          />
        )}

        {runResult && (
          <p
            className="rounded-xl px-3 py-2.5 text-center text-sm font-medium"
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

        {/* Manual fallback note */}
        <p className="text-center text-xs" style={{ color: "var(--muted)" }}>
          {c.manualFallback}
        </p>
      </div>
    </div>
  );
}

// ── StatChip ────────────────────────────────────────────────────────────────────

function StatChip({
  icon,
  value,
  label,
  color,
  bg,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-xl px-3 py-2.5"
      style={{ background: bg }}
    >
      <span style={{ color }}>{icon}</span>
      <span className="text-base font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-center text-[10px] leading-tight" style={{ color, opacity: 0.7 }}>
        {label}
      </span>
    </div>
  );
}
