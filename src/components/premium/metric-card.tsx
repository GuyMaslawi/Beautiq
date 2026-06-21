import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { tone as toneMap, type ToneKey } from "./tokens";

/**
 * PremiumMetricCard — KPI surface with an aura glow behind the number,
 * a glass icon chip, and an optional trend pill. Drop-in superset of the
 * legacy MetricCard props (label/count/icon/helper/highlight/warn/compact)
 * plus `tone`, `trend`, and `spark`.
 */
interface PremiumMetricCardProps {
  label: string;
  count: React.ReactNode;
  icon?: React.ReactNode;
  helper?: string;
  /** legacy aliases — map to tone */
  highlight?: boolean;
  warn?: boolean;
  compact?: boolean;
  tone?: ToneKey;
  trend?: { dir: "up" | "down"; label: string; good?: boolean };
  /** small inline sparkline numbers (0..1 scale) */
  spark?: number[];
  className?: string;
}

export function PremiumMetricCard({
  label,
  count,
  icon,
  helper,
  highlight,
  warn,
  compact,
  tone,
  trend,
  spark,
  className,
}: PremiumMetricCardProps) {
  const t: ToneKey = tone ?? (highlight ? "brand" : warn ? "warning" : "neutral");
  const c = toneMap[t];
  const numColor = t === "neutral" ? "#2b2530" : c.fg;

  if (compact) {
    return (
      <div
        className={cn("flex items-center gap-2 rounded-xl px-3 py-2", className)}
        style={{ background: "rgba(255,255,255,0.78)", border: `1px solid ${c.border}` }}
      >
        {icon && <span style={{ color: c.fg }}>{icon}</span>}
        <span className="display-num text-base font-bold" style={{ color: numColor }}>
          {count}
        </span>
        <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "lift metric-glow relative overflow-hidden rounded-[1.25rem] p-5",
        className,
      )}
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.8) 100%)",
        border: `1px solid ${c.border}`,
        boxShadow: "0 6px 22px -10px rgba(124,58,97,0.16), inset 0 1px 0 rgba(255,255,255,0.9)",
      }}
    >
      <div className="relative z-10 mb-3 flex items-center justify-between">
        {icon && (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.fg }}
          >
            {icon}
          </span>
        )}
        {trend && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{
              background: trend.good === false ? toneMap.danger.bg : toneMap.success.bg,
              color: trend.good === false ? toneMap.danger.fg : toneMap.success.fg,
            }}
          >
            {trend.dir === "up" ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {trend.label}
          </span>
        )}
      </div>
      <p className="display-num relative z-10 text-[1.75rem] font-bold" style={{ color: numColor }}>
        {count}
      </p>
      <p className="relative z-10 mt-1 text-xs font-medium leading-tight" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      {helper && (
        <p className="relative z-10 mt-0.5 text-[10px] leading-tight" style={{ color: "var(--muted-light)" }}>
          {helper}
        </p>
      )}
      {spark && spark.length > 1 && (
        <div className="relative z-10 mt-3 flex h-8 items-end gap-[3px]">
          {spark.map((v, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: `${Math.max(8, Math.min(100, v * 100))}%`,
                background: i === spark.length - 1 ? c.fg : c.bg,
                opacity: i === spark.length - 1 ? 1 : 0.8,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
