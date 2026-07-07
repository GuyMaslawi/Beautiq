import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * MetricCard — כרטיס מדד/סיכום משותף.
 * מאחד את שני ה-SummaryCard שהיו משוכפלים בדפי "תורים" ו"לקוחות".
 * תומך בתצוגה רגילה, תצוגה קומפקטית (compact), שורת עזר (helper),
 * והדגשות highlight (ורוד-מאב) / warn (זהב-חרדל).
 */
interface MetricCardProps {
  label: string;
  count: React.ReactNode;
  icon: React.ReactNode;
  helper?: string;
  highlight?: boolean;
  warn?: boolean;
  compact?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  count,
  icon,
  helper,
  highlight,
  warn,
  compact,
  className,
}: MetricCardProps) {
  const accentColor = highlight ? "#ac5c7f" : warn ? "#b87c1e" : "#2b2530";
  const countColor = highlight ? "#ac5c7f" : warn ? "#7a6400" : "#2b2530";
  const surface = highlight
    ? "rgba(247,238,243,0.85)"
    : warn
    ? "rgba(254,246,228,0.80)"
    : "rgba(255,255,255,0.90)";
  const borderColor = highlight
    ? "rgba(172,92,127,0.22)"
    : warn
    ? "rgba(184,150,10,0.22)"
    : "var(--border)";
  const iconBubbleBg = highlight
    ? "linear-gradient(135deg, rgba(199,111,147,0.18) 0%, rgba(146,96,159,0.13) 100%)"
    : warn
    ? "linear-gradient(135deg, rgba(192,149,96,0.18) 0%, rgba(184,124,30,0.12) 100%)"
    : "linear-gradient(135deg, rgba(199,111,147,0.13) 0%, rgba(146,96,159,0.09) 100%)";

  if (compact) {
    return (
      <div
        className={cn("flex items-center gap-2 rounded-xl px-3 py-2", className)}
        style={{
          background: highlight
            ? "rgba(247,238,243,0.85)"
            : warn
            ? "rgba(254,246,228,0.80)"
            : "rgba(255,255,255,0.80)",
          border: `1px solid ${
            highlight
              ? "rgba(172,92,127,0.20)"
              : warn
              ? "rgba(184,150,10,0.20)"
              : "var(--border)"
          }`,
        }}
      >
        <span style={{ color: accentColor }}>{icon}</span>
        <span className="text-base font-bold tabular-nums" style={{ color: accentColor }}>
          {count}
        </span>
        <span className="text-xs font-medium" style={{ color: "#8a8190" }}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn("rounded-2xl px-5 py-4 transition-shadow hover:shadow-md", className)}
      style={{
        background: surface,
        border: `1px solid ${borderColor}`,
        boxShadow: "0 2px 12px rgba(124,58,97,0.07)",
      }}
    >
      <div
        className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
        style={{
          background: iconBubbleBg,
          border: "1px solid rgba(172,92,127,0.14)",
        }}
      >
        <span style={{ color: highlight ? "#ac5c7f" : warn ? "#b87c1e" : "#ac5c7f" }}>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ color: countColor }}>
        {count}
      </p>
      <p className="mt-1 text-xs font-medium leading-tight" style={{ color: "#8a8190" }}>
        {label}
      </p>
      {helper && (
        <p className="mt-0.5 text-[10px] leading-tight" style={{ color: "#bbb3c2" }}>
          {helper}
        </p>
      )}
    </div>
  );
}
