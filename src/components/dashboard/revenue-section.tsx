import Link from "next/link";
import { TrendingUp, Target, Sparkles, ArrowLeft } from "lucide-react";
import type { RevenueForecastData } from "@/server/revenue-forecast/queries";
import { PremiumMetricCard } from "@/components/premium/metric-card";
import { AuraBlob } from "@/components/premium/aura-blob";

function formatILS(amount: number): string {
  return `₪${Math.round(amount).toLocaleString("he-IL")}`;
}

const CONFIDENCE_LABEL: Record<RevenueForecastData["confidence"], string> = {
  high: "דיוק גבוה",
  medium: "דיוק בינוני",
  low: "דיוק ראשוני",
};

/**
 * Dashboard Revenue band — a single wide premium insight. The end-of-month
 * forecast is the hero (large dark aura card); this month's actual revenue and
 * the gap-to-target sit beside it as supporting metrics. The full breakdown
 * lives in Finance; this is the glance.
 */
export function RevenueSection({ forecast }: { forecast: RevenueForecastData }) {
  // Not enough history yet — keep it calm and encouraging.
  if (!forecast.hasEnoughData) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/finance" className="lift block">
          <div
            className="flex h-full flex-col gap-3 rounded-[1.4rem] p-5"
            style={{
              background: "linear-gradient(135deg, #f0fdf8 0%, #e6f9f0 100%)",
              border: "1px solid rgba(61,139,110,0.22)",
              boxShadow: "0 6px 22px -10px rgba(61,139,110,0.16)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: "rgba(45,107,85,0.85)" }}>
                הכנסה החודש
              </span>
              <TrendingUp className="h-4 w-4" style={{ color: "#3d8b6e" }} />
            </div>
            <p className="display-num text-2xl font-bold" style={{ color: "#2d6b55" }}>
              {formatILS(forecast.completedRevenue)}
            </p>
            <p className="text-xs" style={{ color: "rgba(45,107,85,0.65)" }}>
              מתורים שהושלמו · מעבר לכספים
            </p>
          </div>
        </Link>

        <div className="aura-card flex flex-col justify-center gap-1.5 rounded-[1.4rem] p-5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" style={{ color: "#b86b8c" }} />
            <span className="text-foreground text-sm font-bold">תחזית הכנסות</span>
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
      {/* Forecast — hero band (spans 2 cols on desktop) */}
      <Link href="/finance" className="lift block lg:col-span-2">
        <div
          className="relative h-full overflow-hidden rounded-[1.5rem] p-6 md:p-7"
          style={{
            background: "linear-gradient(150deg, #2b0e1f 0%, #44183a 50%, #2c1527 100%)",
            border: "1px solid rgba(184,107,140,0.3)",
            boxShadow: "0 20px 50px -20px rgba(120,40,80,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <AuraBlob color="rgba(201,120,152,0.3)" size={260} style={{ top: -120, insetInlineEnd: -40 }} />
          <div className="relative flex items-center justify-between">
            <span className="eyebrow" style={{ color: "rgba(240,168,200,0.85)" }}>
              צפי לסוף החודש
            </span>
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
              style={{ background: "rgba(255,255,255,0.1)", color: "#f0a8c8" }}
            >
              {CONFIDENCE_LABEL[forecast.confidence]}
            </span>
          </div>
          <p className="display-num relative mt-3 text-[2.5rem] font-bold text-white">
            {formatILS(forecast.expectedRevenue)}
          </p>
          {forecast.monthlyTarget > 0 && (
            <div className="relative mt-4 space-y-2">
              <div className="h-2 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.14)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, forecast.actualProgressPct)}%`,
                    background: "linear-gradient(90deg, #c97898 0%, #f0a8c8 100%)",
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.6)" }}>
                  יעד החודש {formatILS(forecast.monthlyTarget)}
                </p>
                <span className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: "#f0a8c8" }}>
                  לפירוט מלא
                  <ArrowLeft className="h-3 w-3" />
                </span>
              </div>
            </div>
          )}
        </div>
      </Link>

      {/* Supporting metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
        <Link href="/finance" className="block">
          <PremiumMetricCard
            tone="success"
            icon={<TrendingUp className="h-4 w-4" />}
            count={formatILS(forecast.completedRevenue)}
            label={`${forecast.completedBookingsCount} תורים הושלמו`}
          />
        </Link>
        <Link href="/finance" className="block">
          <PremiumMetricCard
            tone={gapClosed ? "success" : "gold"}
            icon={gapClosed ? <Sparkles className="h-4 w-4" /> : <Target className="h-4 w-4" />}
            count={gapClosed ? "✓" : formatILS(forecast.gapToTarget)}
            label={gapClosed ? "עמידה ביעד · את בדרך הנכונה" : "פער ליעד · איך לסגור אותו"}
          />
        </Link>
      </div>
    </div>
  );
}
