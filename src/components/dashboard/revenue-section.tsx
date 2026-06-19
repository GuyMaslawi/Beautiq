import Link from "next/link";
import { TrendingUp, Target, Sparkles, ArrowLeft } from "lucide-react";
import type { RevenueForecastData } from "@/server/revenue-forecast/queries";

function formatILS(amount: number): string {
  return `₪${Math.round(amount).toLocaleString("he-IL")}`;
}

const CONFIDENCE_LABEL: Record<RevenueForecastData["confidence"], string> = {
  high: "דיוק גבוה",
  medium: "דיוק בינוני",
  low: "דיוק ראשוני",
};

/**
 * Dashboard Revenue section — surfaces the forward-looking forecast (Phase 3
 * recommendation) next to this month's actual revenue. The full breakdown
 * lives in Finance; this is the glance.
 */
export function RevenueSection({ forecast }: { forecast: RevenueForecastData }) {
  // Not enough history yet — keep it calm and encouraging, no noisy numbers.
  if (!forecast.hasEnoughData) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/finance"
          className="flex flex-col gap-3 rounded-2xl p-5 transition-all hover:shadow-md active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #f0fdf8 0%, #e6f9f0 100%)",
            border: "1px solid rgba(61,139,110,0.22)",
            boxShadow: "0 2px 10px rgba(61,139,110,0.08)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: "rgba(45,107,85,0.85)" }}>
              הכנסה החודש
            </span>
            <TrendingUp className="h-4 w-4" style={{ color: "#3d8b6e" }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: "#2d6b55" }}>
            {formatILS(forecast.completedRevenue)}
          </p>
          <p className="text-xs" style={{ color: "rgba(45,107,85,0.65)" }}>
            מתורים שהושלמו · מעבר לכספים
          </p>
        </Link>

        <div
          className="flex flex-col justify-center gap-1.5 rounded-2xl p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" style={{ color: "#b86b8c" }} />
            <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
              תחזית הכנסות
            </span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
            עוד מעט נוכל להציג לך תחזית לסוף החודש ויעד אישי. המשיכי לתעד תורים שהושלמו.
          </p>
        </div>
      </div>
    );
  }

  const gapClosed = forecast.gapToTarget <= 0 || forecast.isOnTrack;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Monthly revenue (actual) */}
      <Link
        href="/finance"
        className="flex flex-col gap-3 rounded-2xl p-5 transition-all hover:shadow-md active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, #f0fdf8 0%, #e6f9f0 100%)",
          border: "1px solid rgba(61,139,110,0.22)",
          boxShadow: "0 2px 10px rgba(61,139,110,0.08)",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: "rgba(45,107,85,0.85)" }}>
            הכנסה החודש
          </span>
          <TrendingUp className="h-4 w-4" style={{ color: "#3d8b6e" }} />
        </div>
        <p className="text-2xl font-bold tabular-nums" style={{ color: "#2d6b55" }}>
          {formatILS(forecast.completedRevenue)}
        </p>
        <p className="text-xs" style={{ color: "rgba(45,107,85,0.65)" }}>
          {forecast.completedBookingsCount} תורים הושלמו
        </p>
      </Link>

      {/* Forecast — featured premium card */}
      <Link
        href="/finance"
        className="relative flex flex-col gap-3 overflow-hidden rounded-2xl p-5 transition-all hover:brightness-110 active:scale-[0.98]"
        style={{
          background: "linear-gradient(145deg, #2b0e1f 0%, #3e1630 55%, #2c1527 100%)",
          border: "1px solid rgba(184,107,140,0.28)",
          boxShadow: "0 8px 28px rgba(120,40,80,0.22)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 80% 10%, rgba(201,120,152,0.22) 0%, transparent 55%)",
          }}
        />
        <div className="relative flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>
            צפי לסוף החודש
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: "rgba(255,255,255,0.10)", color: "#f0a8c8" }}
          >
            {CONFIDENCE_LABEL[forecast.confidence]}
          </span>
        </div>
        <p className="relative text-2xl font-bold tabular-nums text-white">
          {formatILS(forecast.expectedRevenue)}
        </p>
        {forecast.monthlyTarget > 0 && (
          <div className="relative space-y-1.5">
            <div
              className="h-1.5 overflow-hidden rounded-full"
              style={{ background: "rgba(255,255,255,0.14)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, forecast.actualProgressPct)}%`,
                  background: "linear-gradient(90deg, #c97898 0%, #f0a8c8 100%)",
                }}
              />
            </div>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>
              יעד החודש {formatILS(forecast.monthlyTarget)}
            </p>
          </div>
        )}
      </Link>

      {/* Target gap */}
      <Link
        href="/finance"
        className="flex flex-col gap-3 rounded-2xl p-5 transition-all hover:shadow-md active:scale-[0.98]"
        style={
          gapClosed
            ? {
                background: "linear-gradient(135deg, #f0fdf8 0%, #e6f9f0 100%)",
                border: "1px solid rgba(61,139,110,0.22)",
                boxShadow: "0 2px 10px rgba(61,139,110,0.08)",
              }
            : {
                background: "rgba(212,168,30,0.08)",
                border: "1px solid rgba(212,168,30,0.25)",
                boxShadow: "var(--shadow-sm)",
              }
        }
      >
        <div className="flex items-center justify-between">
          <span
            className="text-sm font-medium"
            style={{ color: gapClosed ? "rgba(45,107,85,0.85)" : "#8a6d0a" }}
          >
            {gapClosed ? "עמידה ביעד" : "פער ליעד"}
          </span>
          {gapClosed ? (
            <Sparkles className="h-4 w-4" style={{ color: "#3d8b6e" }} />
          ) : (
            <Target className="h-4 w-4" style={{ color: "#b8960a" }} />
          )}
        </div>
        <p
          className="text-2xl font-bold tabular-nums"
          style={{ color: gapClosed ? "#2d6b55" : "#8a6d0a" }}
        >
          {gapClosed ? "✓" : formatILS(forecast.gapToTarget)}
        </p>
        <span
          className="mt-auto flex items-center gap-1 text-xs font-semibold"
          style={{ color: gapClosed ? "#3d8b6e" : "#b8960a" }}
        >
          {gapClosed ? "את בדרך הנכונה" : "איך לסגור את הפער"}
          <ArrowLeft className="h-3 w-3" />
        </span>
      </Link>
    </div>
  );
}
