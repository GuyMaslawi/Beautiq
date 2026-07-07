import * as React from "react";
import { cn } from "@/lib/utils";

export interface RibbonStat {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "brand" | "success" | "warning";
}

/**
 * StatRibbon — compact inline KPIs shown inside a hero.
 * Glass pills with a thin divider rhythm; wraps gracefully on mobile.
 */
export function StatRibbon({
  stats,
  className,
}: {
  stats: RibbonStat[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-stretch gap-2.5",
        className,
      )}
    >
      {stats.map((s, i) => {
        const color =
          s.tone === "brand"
            ? "#ac5c7f"
            : s.tone === "success"
            ? "#2f7d61"
            : s.tone === "warning"
            ? "#a06a14"
            : "var(--foreground)";
        return (
          <div
            key={i}
            className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5"
            style={{
              background: "rgba(255,255,255,0.62)",
              border: "1px solid rgba(255,255,255,0.7)",
              boxShadow: "0 4px 14px rgba(124,58,97,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
          >
            {s.icon && (
              <span style={{ color }} className="shrink-0">
                {s.icon}
              </span>
            )}
            <span className="flex flex-col leading-tight">
              <span
                className="display-num text-lg font-bold"
                style={{ color }}
              >
                {s.value}
              </span>
              <span className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>
                {s.label}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
