"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MessageSquare, RotateCcw, CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import type { AutomationMessageLogItem } from "@/server/automations/message-queries";
import { retryAutomationMessageAction } from "@/server/automations/retry-action";

// ---------------------------------------------------------------------------
// Label maps — Hebrew friendly
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  win_back: "החזרת לקוחה",
  morning_reminder: "תזכורת לתור",
  review_request: "בקשת ביקורת",
  manual: "הודעה ידנית",
  booking_confirmation: "אישור תור",
};

const STATUS_LABELS: Record<string, string> = {
  queued: "ממתין",
  sent: "נשלח",
  delivered: "נמסר",
  read: "נקרא",
  failed: "נכשל",
  skipped: "לא נשלח",
};

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  queued:    { bg: "rgba(59,122,181,0.08)",   color: "#2e5c8a", border: "rgba(59,122,181,0.25)" },
  sent:      { bg: "rgba(61,139,110,0.08)",   color: "#2a6e57", border: "rgba(61,139,110,0.25)" },
  delivered: { bg: "rgba(61,139,110,0.12)",   color: "#1d5240", border: "rgba(61,139,110,0.35)" },
  read:      { bg: "rgba(184,107,140,0.10)",  color: "#7a3558", border: "rgba(184,107,140,0.30)" },
  failed:    { bg: "rgba(190,74,74,0.09)",    color: "#8b2e2e", border: "rgba(190,74,74,0.25)" },
  skipped:   { bg: "rgba(148,163,184,0.10)",  color: "#6b7280", border: "rgba(148,163,184,0.25)" },
};

const TZ = "Asia/Jerusalem";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("he-IL", {
    timeZone: TZ,
    day: "numeric",
    month: "numeric",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ---------------------------------------------------------------------------
// Retry button — client-side action with optimistic feedback
// ---------------------------------------------------------------------------

function RetryButton({ messageId }: { messageId: string }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function handleRetry() {
    setFeedback(null);
    startTransition(async () => {
      const result = await retryAutomationMessageAction(messageId);
      setFeedback(
        result.success
          ? { ok: true, msg: "נשלח מחדש בהצלחה" }
          : { ok: false, msg: result.error ?? "שליחה נכשלה" },
      );
    });
  }

  if (feedback) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-medium"
        style={{ color: feedback.ok ? "#2a6e57" : "#8b2e2e" }}
      >
        {feedback.ok ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
        {feedback.msg}
      </span>
    );
  }

  return (
    <button
      onClick={handleRetry}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[var(--background-alt)] disabled:opacity-50"
      style={{ borderColor: "var(--border)", color: "var(--foreground-soft)" }}
    >
      <RotateCcw className={`h-3 w-3 ${isPending ? "animate-spin" : ""}`} />
      נסה שוב
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface AutomationMessageLogProps {
  messages: AutomationMessageLogItem[];
}

export function AutomationMessageLog({ messages }: AutomationMessageLogProps) {
  if (messages.length === 0) {
    return (
      <div
        className="rounded-2xl border px-6 py-10 text-center"
        style={{
          borderColor: "var(--border)",
          background: "rgba(255,255,255,0.80)",
          boxShadow: "0 1px 4px rgba(43,37,48,0.06)",
        }}
        dir="rtl"
      >
        <div
          className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ background: "rgba(184,107,140,0.10)" }}
        >
          <MessageSquare className="h-5 w-5" style={{ color: "#b86b8c" }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          עדיין לא נשלחו הודעות
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          אחרי שתפעילי אוטומציות, ההודעות יופיעו כאן.
        </p>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
        boxShadow: "0 1px 4px rgba(43,37,48,0.06)",
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm" dir="rtl">
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--border)",
                background:
                  "linear-gradient(135deg,rgba(247,238,243,0.60) 0%,rgba(255,255,255,0) 100%)",
              }}
            >
              {["תאריך", "לקוח/ה", "סוג הודעה", "סטטוס", "הערה", "פעולות"].map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--muted)" }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {messages.map((msg) => {
              const statusStyle = STATUS_STYLE[msg.status] ?? STATUS_STYLE.skipped;
              const typeLabel = TYPE_LABELS[msg.type] ?? msg.type;
              const statusLabel = STATUS_LABELS[msg.status] ?? msg.status;
              const isFailed = msg.status === "failed";

              // Show a safe owner-facing failure hint — never raw Meta errors
              const failureHint = isFailed
                ? msg.failureReason?.includes("קוד:")
                  ? "שגיאת מסירה — כנראה מספר לא קיים בוואטסאפ"
                  : msg.failureReason?.includes("מצב פיתוח") || msg.failureReason?.includes("mock")
                  ? "מצב פיתוח — לא נשלח"
                  : msg.failureReason?.includes("מצב בדיקה")
                  ? "מצב בדיקה — נחסם"
                  : msg.failureReason?.startsWith("חיבור")
                  ? "חיבור WhatsApp לא מוגדר"
                  : msg.failureReason
                  ? "שגיאה בשליחה"
                  : null
                : null;

              return (
                <tr
                  key={msg.id}
                  className="border-b transition-colors hover:bg-[rgba(247,238,243,0.35)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  {/* Date */}
                  <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "var(--muted)" }}>
                    {formatDate(msg.createdAt)}
                  </td>

                  {/* Client */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/clients/${msg.clientId}`}
                      className="text-sm font-medium hover:underline"
                      style={{ color: "var(--foreground)" }}
                    >
                      {msg.clientName}
                    </Link>
                    {msg.bookingId && (
                      <Link
                        href={`/bookings/${msg.bookingId}`}
                        className="mt-0.5 block text-[10px] hover:underline"
                        style={{ color: "var(--muted)" }}
                      >
                        <Eye className="inline h-2.5 w-2.5 ml-0.5" />
                        לפרטי התור
                      </Link>
                    )}
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        background: "rgba(184,107,140,0.08)",
                        color: "#8a3d60",
                        border: "1px solid rgba(184,107,140,0.20)",
                      }}
                    >
                      {typeLabel}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        background: statusStyle.bg,
                        color: statusStyle.color,
                        border: `1px solid ${statusStyle.border}`,
                      }}
                    >
                      {statusLabel}
                    </span>
                    {msg.retryCount > 0 && (
                      <span
                        className="mt-0.5 block text-[10px]"
                        style={{ color: "var(--muted)" }}
                      >
                        {msg.retryCount}{" "}
                        {msg.retryCount === 1 ? "ניסיון חוזר" : "ניסיונות חוזרים"}
                      </span>
                    )}
                  </td>

                  {/* Failure hint */}
                  <td className="px-4 py-3 max-w-[160px]">
                    {failureHint ? (
                      <span className="text-xs" style={{ color: "#8b2e2e" }}>
                        {failureHint}
                      </span>
                    ) : msg.status === "sent" && msg.sentAt ? (
                      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--muted)" }}>
                        <Clock className="h-3 w-3" />
                        {formatDate(msg.sentAt)}
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted-light)" }}>—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    {isFailed && msg.retryCount < 3 && (
                      <RetryButton messageId={msg.id} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="flex items-center justify-between px-4 py-3 text-xs"
        style={{
          borderTop: "1px solid var(--border)",
          background: "rgba(247,238,243,0.25)",
          color: "var(--muted)",
        }}
        dir="rtl"
      >
        <span>מציג {messages.length} הודעות אחרונות</span>
      </div>
    </div>
  );
}
