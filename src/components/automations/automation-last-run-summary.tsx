"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { LastRunSummary } from "@/server/automations/run-queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRunTime(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const time = d.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (dayStart.getTime() === todayStart.getTime()) return `היום ${time}`;
  if (dayStart.getTime() === yesterdayStart.getTime()) return `אתמול ${time}`;

  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
  }) + ` ${time}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  lastRun: LastRunSummary | null;
}

export function AutomationLastRunSummary({ lastRun }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!lastRun) return null;

  const notSentCount = lastRun.failedCount + lastRun.skippedCount;
  const hasReasons = lastRun.skippedReasons.length > 0;

  return (
    <div
      className="rounded-xl px-3 py-2.5 space-y-2"
      style={{
        background: "rgba(148,163,184,0.05)",
        border: "1px solid var(--border)",
      }}
      dir="rtl"
    >
      {/* Run timestamp */}
      <p className="text-[10px] font-medium" style={{ color: "var(--muted)" }}>
        הרצה אחרונה: {formatRunTime(lastRun.startedAt)}
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs">
        <span className="font-semibold" style={{ color: lastRun.sentCount > 0 ? "#2a6e57" : "var(--muted)" }}>
          נשלחו: {lastRun.sentCount}
        </span>
        <span className="text-[10px]" style={{ color: "var(--border)" }}>|</span>
        <span style={{ color: notSentCount > 0 ? "#8b5e3c" : "var(--muted)" }}>
          לא נשלחו: {notSentCount}
        </span>
        {lastRun.failedCount > 0 && (
          <>
            <span className="text-[10px]" style={{ color: "var(--border)" }}>|</span>
            <span style={{ color: "#8b2e2e" }}>נכשלו: {lastRun.failedCount}</span>
          </>
        )}
      </div>

      {/* Expandable reasons */}
      {notSentCount > 0 && hasReasons && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[10px] font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--muted)" }}
          >
            <ChevronDown
              className="h-3 w-3 transition-transform"
              style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
            />
            למה חלק לא קיבלו?
          </button>

          {expanded && (
            <div className="mt-1.5 space-y-0.5 ps-4">
              {lastRun.skippedReasons.map(({ reason, count }) => (
                <div key={reason} className="flex items-center justify-between text-[10px]">
                  <span style={{ color: "var(--foreground-soft, #666)" }}>{reason}</span>
                  <span className="tabular-nums font-medium" style={{ color: "var(--muted)" }}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
