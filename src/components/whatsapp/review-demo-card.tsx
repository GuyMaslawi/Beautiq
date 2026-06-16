"use client";

import { useState } from "react";
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Send,
  RotateCw,
  Info,
} from "lucide-react";
import type { ReviewDemoStatus } from "@/server/whatsapp/review-demo";

interface SendResponse {
  success: boolean;
  blocked?: boolean;
  providerMessageId?: string | null;
  status?: "sent" | "failed" | "skipped";
  reason?: string;
  runId?: string;
}

const STATE_STYLE: Record<
  ReviewDemoStatus["state"],
  { bg: string; border: string; color: string }
> = {
  not_connected: {
    bg: "rgba(234,179,8,0.08)",
    border: "rgba(234,179,8,0.28)",
    color: "#92400e",
  },
  connected_disabled: {
    bg: "rgba(234,179,8,0.08)",
    border: "rgba(234,179,8,0.28)",
    color: "#92400e",
  },
  ready: {
    bg: "rgba(22,163,74,0.06)",
    border: "rgba(22,163,74,0.20)",
    color: "#14532d",
  },
};

export function ReviewDemoCard({
  status,
  businessId,
}: {
  status: ReviewDemoStatus;
  businessId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stateStyle = STATE_STYLE[status.state];

  async function handleSend() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/whatsapp/review-test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const data = (await res.json()) as SendResponse & { error?: string };
      if (!res.ok && data.error && !data.reason) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
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
      <div
        className="flex items-center gap-3 px-5 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
          style={{ background: "rgba(184,107,140,0.10)" }}
        >
          <ShieldCheck className="h-4 w-4" style={{ color: "#b86b8c" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              סקירת Meta — מצב הדגמה
            </h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
              Admin
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            סטטוס חיבור, תבניות והרשאות לשליחת הודעת בדיקה אמיתית עבור סקירת Meta.
          </p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Reviewer-facing copy banner */}
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3"
          style={{ background: stateStyle.bg, border: `1px solid ${stateStyle.border}` }}
        >
          <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: stateStyle.color }} />
          <div className="space-y-0.5">
            <p
              className="text-sm leading-relaxed font-medium"
              style={{ color: stateStyle.color }}
            >
              {status.message}
            </p>
            {status.displayPhoneNumber && (
              <p className="text-xs" style={{ color: stateStyle.color }}>
                מספר מחובר: {status.displayPhoneNumber}
              </p>
            )}
          </div>
        </div>

        {/* Guard checklist */}
        <ul className="space-y-1.5">
          {status.checks.map((check) => (
            <li key={check.label} className="flex items-center gap-2 text-xs">
              {check.ok ? (
                <CheckCircle className="h-3.5 w-3.5 shrink-0" style={{ color: "#15803d" }} />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0" style={{ color: "#dc2626" }} />
              )}
              <span style={{ color: "var(--foreground)" }}>{check.label}</span>
              {check.value && (
                <span className="ms-auto" style={{ color: "var(--muted)" }}>
                  {check.value}
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* Test-send action */}
        <div className="pt-1 space-y-2">
          <button
            onClick={handleSend}
            disabled={loading || !status.canTestSend}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: status.canTestSend
                ? "rgba(22,163,74,0.10)"
                : "rgba(107,114,128,0.08)",
              border: `1px solid ${status.canTestSend ? "rgba(22,163,74,0.25)" : "var(--border)"}`,
              color: status.canTestSend ? "#15803d" : "var(--muted)",
            }}
          >
            {loading ? (
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {loading ? "שולח..." : "שליחת הודעת בדיקה ל-Meta"}
          </button>

          {!status.canTestSend && status.blockReason && (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {status.blockReason}
            </p>
          )}

          {result && (
            <div
              className="rounded-xl px-3 py-2 text-xs space-y-1"
              style={{
                background:
                  result.status === "sent"
                    ? "rgba(22,163,74,0.06)"
                    : "rgba(220,38,38,0.06)",
                border: `1px solid ${
                  result.status === "sent"
                    ? "rgba(22,163,74,0.20)"
                    : "rgba(220,38,38,0.20)"
                }`,
                color: result.status === "sent" ? "#15803d" : "#991b1b",
              }}
            >
              <p className="font-semibold">
                {result.status === "sent"
                  ? "ההודעה נשלחה למספר הבדיקה."
                  : result.blocked
                    ? "השליחה נחסמה."
                    : "ההודעה לא נשלחה."}
              </p>
              {result.providerMessageId && (
                <p style={{ direction: "ltr", textAlign: "left" }}>
                  Message ID: {result.providerMessageId}
                </p>
              )}
              {result.status && <p>סטטוס: {result.status}</p>}
              {result.reason && <p>{result.reason}</p>}
            </div>
          )}

          {error && (
            <p
              className="text-xs rounded-xl px-3 py-2"
              style={{ background: "rgba(220,38,38,0.06)", color: "#dc2626" }}
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
