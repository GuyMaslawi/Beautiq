"use client";

import { useState } from "react";
import { Play, RotateCw, CheckCircle, XCircle, Terminal } from "lucide-react";

interface CronRunResult {
  processed: number;
  totalSent: number;
  totalFailed: number;
  totalSkipped: number;
}

type AutomationType = "reminder" | "review" | "winback";

const AUTOMATION_CONFIG: Record<
  AutomationType,
  { label: string; route: string; hebrew: string }
> = {
  reminder: {
    label: "בדיקת תזכורות עכשיו",
    route: "/api/admin/automation/reminder-now",
    hebrew: "תזכורות לתורים",
  },
  review: {
    label: "בדיקת בקשות ביקורת עכשיו",
    route: "/api/admin/automation/review-now",
    hebrew: "בקשות ביקורת",
  },
  winback: {
    label: "בדיקת החזרת לקוחות עכשיו",
    route: "/api/admin/automation/run-now",
    hebrew: "החזרת לקוחות",
  },
};

function StatusPill({
  ok,
  children,
}: {
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        background: ok ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)",
        color: ok ? "#15803d" : "#dc2626",
        border: `1px solid ${ok ? "rgba(22,163,74,0.20)" : "rgba(220,38,38,0.20)"}`,
      }}
    >
      {ok ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {children}
    </span>
  );
}

function CronButton({
  type,
  businessId,
}: {
  type: AutomationType;
  businessId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CronRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cfg = AUTOMATION_CONFIG[type];

  async function handleRun() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(cfg.route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? `שגיאה ${res.status}`);
      } else {
        setResult(data as CronRunResult);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleRun}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          style={{
            background: "rgba(107,114,128,0.10)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        >
          {loading ? (
            <RotateCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {loading ? "מריץ..." : cfg.label}
        </button>

        {result && !loading && (
          <div className="flex items-center gap-2">
            <StatusPill ok={result.totalSent > 0}>
              {result.totalSent > 0 ? `נשלחו ${result.totalSent}` : "לא נשלחו"}
            </StatusPill>
            {result.totalFailed > 0 && (
              <StatusPill ok={false}>נכשלו {result.totalFailed}</StatusPill>
            )}
            {result.totalSkipped > 0 && (
              <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                דולגו {result.totalSkipped}
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs rounded-xl px-3 py-2" style={{ background: "rgba(220,38,38,0.06)", color: "#dc2626" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export function AdminCronTestCard({ businessId }: { businessId: string }) {
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
          style={{ background: "rgba(107,114,128,0.10)" }}
        >
          <Terminal className="h-4 w-4" style={{ color: "var(--muted)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              בדיקות קרון — Admin
            </h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
              Admin
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            הפעלה מיידית של כל אוטומציה — מדלגת על פילטר שעה ומפעילה את אותה לוגיקה כמו הקרון.
            כל ההגנות האחרות פעילות (dedup, test mode, phone validation).
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div className="px-5 py-4 space-y-3">
        <CronButton type="reminder" businessId={businessId} />
        <CronButton type="review" businessId={businessId} />
        <CronButton type="winback" businessId={businessId} />
      </div>
    </div>
  );
}
