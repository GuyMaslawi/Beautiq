"use client";

import { useState, useTransition } from "react";
import {
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Loader2,
  Users,
  Settings2,
} from "lucide-react";
import {
  checkWinBackEligibilityAction,
  runWinBackManualAction,
} from "@/server/win-back-automation/manual-run-action";
import type {
  EligibilityCheckResult,
  ManualRunResult,
} from "@/server/win-back-automation/manual-run-action";
import { EligibilityReasonCards } from "./eligibility-reason-cards";

// ---------------------------------------------------------------------------
// Status display config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> =
  {
    sent:      { label: "נשלח",  bg: "rgba(61,139,110,0.08)",  color: "#2a6e57", border: "rgba(61,139,110,0.25)"  },
    delivered: { label: "נמסר",  bg: "rgba(61,139,110,0.12)",  color: "#1d5240", border: "rgba(61,139,110,0.35)"  },
    read:      { label: "נקרא",  bg: "rgba(184,107,140,0.10)", color: "#7a3558", border: "rgba(184,107,140,0.30)" },
    failed:    { label: "נכשל",  bg: "rgba(190,74,74,0.09)",   color: "#8b2e2e", border: "rgba(190,74,74,0.25)"   },
    skipped:   { label: "דולג",  bg: "rgba(148,163,184,0.10)", color: "#6b7280", border: "rgba(148,163,184,0.25)" },
    queued:    { label: "ממתין", bg: "rgba(59,122,181,0.08)",  color: "#2e5c8a", border: "rgba(59,122,181,0.25)"  },
  };

// Show safe owner-facing hint — never expose raw provider errors
function safeFailureHint(reason: string | null): string | null {
  if (!reason) return null;
  if (reason.includes("מצב פיתוח") || reason.toLowerCase().includes("mock"))
    return "מצב פיתוח — לא נשלח בפועל";
  if (reason.includes("מצב בדיקה — שליחה מותרת"))
    return "נחסם — מצב בדיקה: נשלח רק למספר הבדיקה";
  if (reason.includes("חיבור WhatsApp"))
    return "חיבור WhatsApp לא מוגדר";
  if (reason.includes("מספר טלפון"))
    return "מספר טלפון לא תקין";
  return reason;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span style={{ color: "var(--foreground-soft)" }}>{label}</span>
      <span
        className="font-medium"
        style={{ color: ok ? "#2a6e57" : "var(--foreground)" }}
      >
        {value}
      </span>
    </div>
  );
}

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-2 rounded-xl px-3 py-2.5"
      style={{
        background: "rgba(234,179,8,0.07)",
        border: "1px solid rgba(234,179,8,0.22)",
      }}
    >
      <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#b45309" }} />
      <p className="text-xs leading-relaxed" style={{ color: "#92400e" }}>
        {children}
      </p>
    </div>
  );
}

function WarnBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-2 rounded-xl px-3 py-2.5"
      style={{
        background: "rgba(190,74,74,0.07)",
        border: "1px solid rgba(190,74,74,0.20)",
      }}
    >
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#8b2e2e" }} />
      <p className="text-xs leading-relaxed" style={{ color: "#8b2e2e" }}>
        {children}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Step = "idle" | "checking" | "ready" | "confirming" | "running" | "done";

export function ManualRunCard({ isAdmin = false }: { isAdmin?: boolean }) {
  const [step, setStep] = useState<Step>("idle");
  const [eligibilityData, setEligibilityData] = useState<EligibilityCheckResult | null>(null);
  const [runResult, setRunResult] = useState<ManualRunResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [ignoreCooldown, setIgnoreCooldown] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleIgnoreCooldownChange(value: boolean) {
    setIgnoreCooldown(value);
    // Reset check results because they were computed under the old setting
    if (step !== "idle" && step !== "done") {
      setStep("idle");
      setEligibilityData(null);
    }
  }

  function handleCheck() {
    setActionError(null);
    setStep("checking");
    startTransition(async () => {
      const result = await checkWinBackEligibilityAction(
        isAdmin ? { ignoreCooldown } : undefined,
      );
      if (!result.success) {
        setActionError(result.error ?? "בדיקה נכשלה. יש לנסות שוב.");
        setStep("idle");
        return;
      }
      setEligibilityData(result);
      setStep("ready");
    });
  }

  function handleRun() {
    setActionError(null);
    setStep("running");
    startTransition(async () => {
      const result = await runWinBackManualAction(
        isAdmin ? { ignoreCooldown } : undefined,
      );
      setRunResult(result);
      setStep("done");
    });
  }

  const eligible = eligibilityData?.breakdown?.eligible ?? 0;

  return (
    <div
      className="col-span-2 rounded-2xl border"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
        boxShadow: "0 1px 4px rgba(43,37,48,0.06)",
      }}
      dir="rtl"
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
          style={{ background: "rgba(184,107,140,0.10)" }}
        >
          <Play className="h-4 w-4" style={{ color: "#b86b8c" }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            בדיקת אוטומציה
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            הריצו בדיקה מיידית כדי לראות אילו לקוחות זכאים לקבל הודעה ומה סטטוס השליחה.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {/* Action error */}
        {actionError && <WarnBanner>{actionError}</WarnBanner>}

        {/* ── Admin test options (visible in idle + ready states) ────────── */}
        {isAdmin && step !== "running" && step !== "done" && (
          <div
            className="rounded-xl p-3 space-y-2"
            style={{
              background: "rgba(107,114,128,0.05)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center gap-2">
              <Settings2 className="h-3.5 w-3.5" style={{ color: "var(--muted)" }} />
              <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                אפשרויות בדיקה
              </p>
              <span className="ms-auto rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                Admin
              </span>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ignoreCooldown}
                onChange={(e) => handleIgnoreCooldownChange(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
              />
              <div>
                <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                  התעלמות מתקופת המתנה לבדיקה
                </p>
                <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: "var(--muted)" }}>
                  כולל לקוחות שכבר קיבלו הודעה לאחרונה — משפיע רק על הרצה ידנית זו, לא על האוטומציה הרגילה
                </p>
              </div>
            </label>
          </div>
        )}

        {/* ── IDLE ─────────────────────────────────────────── */}
        {step === "idle" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm" style={{ color: "var(--foreground-soft)" }}>
              לחצו על ״בדיקת זכאות״ כדי לראות כמה לקוחות זכאים לקבל הודעת החזרת לקוחות — לפני שמחליטים לשלוח.
            </p>
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleCheck}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: "#b86b8c", color: "#fff" }}
              >
                <Users className="h-4 w-4" />
                בדיקת זכאות
              </button>
            </div>
          </div>
        )}

        {/* ── CHECKING ─────────────────────────────────────── */}
        {step === "checking" && (
          <div className="flex items-center gap-2.5 py-3">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#b86b8c" }} />
            <p className="text-sm" style={{ color: "var(--muted)" }}>בודקת זכאות לקוחות…</p>
          </div>
        )}

        {/* ── READY / CONFIRMING ───────────────────────────── */}
        {(step === "ready" || step === "confirming") && eligibilityData && (
          <div className="space-y-4">
            {/* Mode banners */}
            {!eligibilityData.realSendConfigured && (
              <InfoBanner>
                <strong>מצב פיתוח</strong> — WhatsApp Business לא מחובר. לא יישלחו הודעות ללקוחות אמיתיים בשום מקרה.
              </InfoBanner>
            )}
            {eligibilityData.realSendConfigured && eligibilityData.testModeActive && (
              <InfoBanner>
                <strong>מצב בדיקה פעיל</strong> — גם אם לקוחה זכאית, ההודעה
                תישלח <strong>רק למספר הבדיקה
                {eligibilityData.maskedTestPhone ? ` (${eligibilityData.maskedTestPhone})` : ""}</strong>,
                ולא למספר הטלפון של הלקוחה.
              </InfoBanner>
            )}
            {!eligibilityData.automationEnabled && (
              <WarnBanner>
                האוטומציה כבויה — יש להפעיל אותה כדי לשלוח הודעות.
              </WarnBanner>
            )}

            {/* Breakdown */}
            {eligibilityData.breakdown ? (
              <>
                {/* Visual eligibility reason cards */}
                {eligibilityData.blockedClients && (
                  <EligibilityReasonCards
                    blockedClients={eligibilityData.blockedClients}
                    realSendConfigured={eligibilityData.realSendConfigured}
                    whatsappConnected={eligibilityData.whatsappConnected}
                  />
                )}

                {/* Admin cooldown override note */}
                {eligibilityData.breakdown.cooldownOverrideCount > 0 && (
                  <div className="flex items-center justify-between text-xs rounded-xl px-3 py-2"
                    style={{ background: "rgba(61,139,110,0.06)", border: "1px solid rgba(61,139,110,0.18)" }}
                  >
                    <span style={{ color: "#2a6e57" }}>
                      עברו תקופת המתנה — כלולות בגלל הגדרת בדיקה (Admin)
                    </span>
                    <span className="font-medium tabular-nums" style={{ color: "#2a6e57" }}>
                      {eligibilityData.breakdown.cooldownOverrideCount}
                    </span>
                  </div>
                )}

                {/* Eligible client list */}
                {eligibilityData.eligibleClients.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                      לקוחות זכאיות ({eligible}):
                    </p>
                    <div
                      className="max-h-44 overflow-y-auto rounded-xl border divide-y"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--background)",
                      }}
                    >
                      {eligibilityData.eligibleClients.map((c, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-3 py-2"
                        >
                          <span
                            className="text-sm font-medium"
                            style={{ color: "var(--foreground)" }}
                          >
                            {c.name}
                          </span>
                          <div
                            className="flex items-center gap-3 text-xs"
                            style={{ color: "var(--muted)" }}
                          >
                            <span className="tabular-nums">{c.maskedPhone}</span>
                            <span className="max-w-[100px] truncate">{c.lastService}</span>
                            <span className="tabular-nums whitespace-nowrap">
                              {c.daysSinceLastVisit} ימים
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions row */}
                {step === "ready" && (
                  <div className="flex items-center gap-3 pt-1">
                    {eligible > 0 && eligibilityData.automationEnabled ? (
                      <button
                        onClick={() => setStep("confirming")}
                        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98]"
                        style={{ background: "#b86b8c", color: "#fff" }}
                      >
                        <Play className="h-3.5 w-3.5" />
                        שליחה עכשיו
                      </button>
                    ) : eligible === 0 ? (
                      <div
                        className="rounded-xl px-3 py-2"
                        style={{
                          background: "rgba(148,163,184,0.08)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                          אין לקוחות זכאים לשליחה כרגע
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                          לא נשלחה ולא תישלח הודעה בפועל
                        </p>
                      </div>
                    ) : null}

                    <button
                      onClick={handleCheck}
                      disabled={isPending}
                      className="text-xs underline disabled:opacity-50"
                      style={{ color: "var(--muted)" }}
                    >
                      רענן
                    </button>
                    <button
                      onClick={() => {
                        setStep("idle");
                        setEligibilityData(null);
                      }}
                      className="text-xs underline"
                      style={{ color: "var(--muted)" }}
                    >
                      סגור
                    </button>
                  </div>
                )}

                {/* Confirmation panel */}
                {step === "confirming" && (
                  <div
                    className="rounded-xl p-4 space-y-3"
                    style={{
                      background: "rgba(184,107,140,0.06)",
                      border: "1px solid rgba(184,107,140,0.22)",
                    }}
                  >
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {eligibilityData.realSendConfigured && !eligibilityData.testModeActive
                        ? `הפעולה תשלח הודעות WhatsApp ל־${eligible} לקוחות זכאים. להמשיך?`
                        : eligibilityData.realSendConfigured && eligibilityData.testModeActive
                        ? `ההודעות יישלחו למספר הבדיקה${eligibilityData.maskedTestPhone ? ` (${eligibilityData.maskedTestPhone})` : ""} בלבד — לא ללקוחות. להמשיך?`
                        : `מצב פיתוח — לא תישלח הודעה אמיתית ל־${eligible} לקוחות. להמשיך?`}
                    </p>
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={handleRun}
                        disabled={isPending}
                        className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: "#b86b8c", color: "#fff" }}
                      >
                        {isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5" />
                        )}
                        אישור — שלח עכשיו
                      </button>
                      <button
                        onClick={() => setStep("ready")}
                        disabled={isPending}
                        className="text-xs underline disabled:opacity-50"
                        style={{ color: "var(--muted)" }}
                      >
                        ביטול
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                לא נמצאו הגדרות אוטומציה. יש להגדיר את אוטומציית החזרת הלקוחות תחילה.
              </p>
            )}
          </div>
        )}

        {/* ── RUNNING ──────────────────────────────────────── */}
        {step === "running" && (
          <div className="flex items-center gap-2.5 py-3">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#b86b8c" }} />
            <p className="text-sm" style={{ color: "var(--muted)" }}>מריץ אוטומציה…</p>
          </div>
        )}

        {/* ── DONE ─────────────────────────────────────────── */}
        {step === "done" && runResult && (
          <div className="space-y-4">
            {/* Run error */}
            {!runResult.success && runResult.error && (
              <WarnBanner>{runResult.error}</WarnBanner>
            )}

            {/* Clear result summary */}
            {runResult.success && (
              <div
                className="rounded-xl p-3 space-y-1.5"
                style={{
                  background: "rgba(148,163,184,0.06)",
                  border: "1px solid var(--border)",
                }}
              >
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>
                  סיכום הרצה:
                </p>
                <SummaryRow
                  label="הודעה נשלחה בפועל"
                  value={
                    runResult.sentCount > 0
                      ? `כן — ${runResult.sentCount} הודעות`
                      : "לא — לא נשלחה הודעה"
                  }
                  ok={runResult.sentCount > 0}
                />
                <SummaryRow
                  label="מצב שליחה"
                  value={
                    runResult.isMockMode
                      ? "פיתוח (dev_mock)"
                      : runResult.isTestMode
                      ? "בדיקה (test mode)"
                      : "אמיתי"
                  }
                />
                <SummaryRow
                  label="נמען בפועל"
                  value={
                    runResult.isMockMode
                      ? "לא נשלח"
                      : runResult.isTestMode
                      ? `מספר הבדיקה${runResult.maskedTestPhone ? ` (${runResult.maskedTestPhone})` : ""}`
                      : "מספר הטלפון של הלקוחה"
                  }
                />
              </div>
            )}

            {/* Summary stats */}
            {runResult.success && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "נשלחו", value: runResult.sentCount, accent: runResult.sentCount > 0 },
                  { label: "נכשלו", value: runResult.failedCount, accent: false },
                  { label: "דולגו", value: runResult.skippedCount, accent: false },
                ].map(({ label, value, accent }) => {
                  const isAccented = accent && value > 0;
                  return (
                    <div
                      key={label}
                      className="rounded-xl px-3 py-2.5 text-center"
                      style={{
                        background: isAccented ? "rgba(61,139,110,0.08)" : "rgba(148,163,184,0.07)",
                        border: `1px solid ${isAccented ? "rgba(61,139,110,0.20)" : "var(--border)"}`,
                      }}
                    >
                      <p className="text-xl font-bold" style={{ color: isAccented ? "#2a6e57" : "var(--foreground)" }}>
                        {value}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>{label}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* No messages sent */}
            {runResult.success && runResult.messages.length === 0 && (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                לא נשלחו הודעות בהרצה הזאת.
              </p>
            )}
            {runResult.success &&
              runResult.messages.length > 0 &&
              runResult.sentCount === 0 && (
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  לא נשלחו הודעות בפועל — כל הלקוחות דולגו או נכשלו.
                </p>
              )}

            {/* Per-client table */}
            {runResult.messages.length > 0 && (
              <div className="space-y-1.5">
                <div
                  className="overflow-hidden rounded-xl border"
                  style={{ borderColor: "var(--border)" }}
                >
                  <table className="w-full text-xs" dir="rtl">
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: "rgba(247,238,243,0.40)",
                        }}
                      >
                        {["שם", "טלפון לקוחה", "סטטוס", "הערה"].map((col) => (
                          <th
                            key={col}
                            className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide"
                            style={{ color: "var(--muted)" }}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {runResult.messages.map((msg, i) => {
                        const cfg = STATUS_CONFIG[msg.status] ?? STATUS_CONFIG.skipped;
                        const hint = safeFailureHint(msg.failureReason);
                        return (
                          <tr
                            key={msg.clientId + i}
                            className="border-b last:border-b-0 hover:bg-[rgba(247,238,243,0.30)] transition-colors"
                            style={{ borderColor: "var(--border)" }}
                          >
                            <td
                              className="px-3 py-2 font-medium whitespace-nowrap"
                              style={{ color: "var(--foreground)" }}
                            >
                              {msg.clientName}
                            </td>
                            <td
                              className="px-3 py-2 tabular-nums whitespace-nowrap"
                              style={{ color: "var(--muted)" }}
                            >
                              {msg.maskedPhone}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 font-medium"
                                style={{
                                  background: cfg.bg,
                                  color: cfg.color,
                                  border: `1px solid ${cfg.border}`,
                                }}
                              >
                                {cfg.label}
                              </span>
                            </td>
                            <td
                              className="px-3 py-2 max-w-[160px]"
                              style={{ color: "var(--muted)" }}
                            >
                              {hint ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Footnote when test mode sent to test phone, not client */}
                {runResult.isTestMode && runResult.sentCount > 0 && (
                  <p className="text-[10px] leading-relaxed" style={{ color: "var(--muted)" }}>
                    * הודעות שנשלחו הועברו למספר הבדיקה{runResult.maskedTestPhone ? ` (${runResult.maskedTestPhone})` : ""}, לא למספר הטלפון של הלקוחה המוצג בטבלה.
                  </p>
                )}
              </div>
            )}

            {/* Reset */}
            <div className="flex items-center gap-2.5 pt-1">
              <button
                onClick={() => {
                  setStep("idle");
                  setRunResult(null);
                  setEligibilityData(null);
                  setActionError(null);
                }}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98]"
                style={{
                  background: "rgba(184,107,140,0.10)",
                  color: "#8a3d60",
                  border: "1px solid rgba(184,107,140,0.20)",
                }}
              >
                <XCircle className="h-3.5 w-3.5" />
                הרצה חדשה
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
