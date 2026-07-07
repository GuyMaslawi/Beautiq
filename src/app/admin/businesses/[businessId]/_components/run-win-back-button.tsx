"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, RotateCw } from "lucide-react";

interface RunResult {
  processed: number;
  totalSent: number;
  totalFailed: number;
  totalMock: number;
  results: Array<{
    businessId: string;
    businessName: string;
    success: boolean;
    sentCount: number;
    failedCount: number;
    skippedCount: number;
    mockSkipCount: number;
    runId?: string;
    error?: string;
  }>;
}

export function RunWinBackButton({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/automation/run-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? `שגיאה ${res.status}`);
      } else {
        setResult(data as RunResult);
        router.refresh();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={handleRun}
          disabled={loading}
          className="bg-brand-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? (
            <RotateCw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {loading ? "מריץ..." : "הפעל Win-Back עכשיו"}
        </button>
        {result && !loading && (
          <span className="text-xs font-medium" style={{ color: "var(--success)" }}>
            הושלם — נשלחו {result.totalSent}, דמה {result.totalMock}, נכשלו {result.totalFailed}
          </span>
        )}
      </div>

      {error && (
        <div
          className="rounded-xl p-3 text-sm"
          style={{
            background: "var(--error-light)",
            border: "1px solid color-mix(in srgb, var(--error) 25%, transparent)",
            color: "var(--error)",
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "var(--mauve-light)",
            border: "1px solid color-mix(in srgb, var(--mauve) 20%, transparent)",
          }}
        >
          <p className="mb-2 text-xs font-bold" style={{ color: "var(--mauve)" }}>
            תוצאת הרצה
          </p>
          <pre
            className="overflow-x-auto text-xs text-foreground"
            style={{ fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
