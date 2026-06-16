"use client";

import { useState, useTransition } from "react";
import { Stethoscope, CheckCircle, XCircle, Search, Send, RotateCw, Info } from "lucide-react";
import {
  runWhatsAppDryRunAction,
  runWhatsAppTestSendAction,
  type TestSendActionResult,
} from "@/server/whatsapp/diagnostics-actions";
import type {
  DiagnosticMessageType,
  WhatsAppSendEvaluation,
} from "@/server/whatsapp/diagnostics";

const MESSAGE_TYPES: { value: DiagnosticMessageType; label: string }[] = [
  { value: "booking_confirmation", label: "אישור תור" },
  { value: "morning_reminder", label: "תזכורת לפני תור" },
  { value: "review_request", label: "בקשת ביקורת" },
  { value: "win_back", label: "החזרת לקוחות" },
  { value: "manual", label: "הודעת בדיקה" },
];

export interface DiagnosticsClientOption {
  id: string;
  label: string;
}

export function WhatsAppDiagnosticsPanel({
  clients,
}: {
  clients: DiagnosticsClientOption[];
}) {
  const [messageType, setMessageType] = useState<DiagnosticMessageType>("booking_confirmation");
  const [clientId, setClientId] = useState<string>("");
  const [evaluation, setEvaluation] = useState<WhatsAppSendEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<TestSendActionResult | null>(null);
  const [isDryRunning, startDryRun] = useTransition();
  const [isSending, startSend] = useTransition();

  // win_back / booking_confirmation etc. benefit from a client; manual doesn't.
  const clientRelevant = messageType !== "manual";

  function handleDryRun() {
    setError(null);
    setSendResult(null);
    startDryRun(async () => {
      const res = await runWhatsAppDryRunAction({
        messageType,
        clientId: clientRelevant ? clientId || undefined : undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "אירעה שגיאה.");
        setEvaluation(null);
        return;
      }
      setEvaluation(res.evaluation ?? null);
    });
  }

  function handleTestSend() {
    setError(null);
    startSend(async () => {
      const res = await runWhatsAppTestSendAction();
      setSendResult(res);
    });
  }

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
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
          style={{ background: "rgba(184,107,140,0.10)" }}
        >
          <Stethoscope className="h-4 w-4" style={{ color: "#b86b8c" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              בדיקת שליחת WhatsApp
            </h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
              Admin
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            בודק בדיוק מדוע הודעה תישלח או תיחסם — ללא שליחה בפועל.
          </p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Controls */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--muted)" }}>
            סוג הודעה
            <select
              value={messageType}
              onChange={(e) => {
                setMessageType(e.target.value as DiagnosticMessageType);
                setEvaluation(null);
              }}
              className="rounded-xl px-3 py-2 text-sm"
              style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              {MESSAGE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--muted)" }}>
            לקוחה (לא חובה)
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={!clientRelevant}
              className="rounded-xl px-3 py-2 text-sm disabled:opacity-50"
              style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              <option value="">— ללא לקוחה (בדיקת מערכת) —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDryRun}
            disabled={isDryRunning}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            style={{ background: "rgba(184,107,140,0.10)", border: "1px solid rgba(184,107,140,0.25)", color: "#b86b8c" }}
          >
            {isDryRunning ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            {isDryRunning ? "בודק..." : "בדיקת זכאות לשליחה"}
          </button>

          <button
            onClick={handleTestSend}
            disabled={isSending}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            style={{ background: "rgba(22,163,74,0.10)", border: "1px solid rgba(22,163,74,0.25)", color: "#15803d" }}
          >
            {isSending ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {isSending ? "שולח..." : "שליחת הודעת בדיקה"}
          </button>
        </div>

        <p className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
          <Info className="h-3 w-3 shrink-0" />
          שליחת הבדיקה נשלחת אך ורק למספר הבדיקה המוגדר (WHATSAPP_TEST_PHONE), ורק אם כל הבדיקות עוברות.
        </p>

        {error && (
          <p className="text-xs rounded-xl px-3 py-2" style={{ background: "rgba(220,38,38,0.06)", color: "#dc2626" }}>
            {error}
          </p>
        )}

        {/* Dry-run result */}
        {evaluation && (
          <div className="space-y-3">
            <div
              className="flex items-start gap-3 rounded-xl px-4 py-3"
              style={{
                background: evaluation.wouldSend ? "rgba(22,163,74,0.06)" : "rgba(234,179,8,0.08)",
                border: `1px solid ${evaluation.wouldSend ? "rgba(22,163,74,0.20)" : "rgba(234,179,8,0.28)"}`,
              }}
            >
              {evaluation.wouldSend ? (
                <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#15803d" }} />
              ) : (
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#b45309" }} />
              )}
              <div className="space-y-0.5">
                <p className="text-sm font-semibold" style={{ color: evaluation.wouldSend ? "#14532d" : "#92400e" }}>
                  {evaluation.wouldSend
                    ? `ההודעה (${evaluation.messageTypeLabel}) תישלח`
                    : `ההודעה (${evaluation.messageTypeLabel}) לא תישלח`}
                </p>
                {!evaluation.wouldSend && evaluation.blockReason && (
                  <p className="text-xs" style={{ color: "#92400e" }}>
                    סיבה: {evaluation.blockReason.label}
                    <span className="opacity-60"> ({evaluation.blockReason.code})</span>
                  </p>
                )}
              </div>
            </div>

            <ul className="space-y-1.5">
              {evaluation.checks.map((check) => (
                <li key={check.key} className="flex items-center gap-2 text-xs">
                  {check.ok ? (
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" style={{ color: "#15803d" }} />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0" style={{ color: "#dc2626" }} />
                  )}
                  <span style={{ color: "var(--foreground)" }}>{check.label}</span>
                  {check.detail && (
                    <span className="ms-auto text-end" style={{ color: "var(--muted)" }}>
                      {check.detail}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Test-send result */}
        {sendResult && (
          <div
            className="rounded-xl px-3 py-2 text-xs space-y-1"
            style={{
              background: sendResult.sent ? "rgba(22,163,74,0.06)" : "rgba(220,38,38,0.06)",
              border: `1px solid ${sendResult.sent ? "rgba(22,163,74,0.20)" : "rgba(220,38,38,0.20)"}`,
              color: sendResult.sent ? "#15803d" : "#991b1b",
            }}
          >
            <p className="font-semibold">{sendResult.message}</p>
            {sendResult.status && <p>סטטוס: {sendResult.status}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
