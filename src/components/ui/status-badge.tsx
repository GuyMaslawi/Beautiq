import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneStyles: Record<BadgeTone, React.CSSProperties> = {
  neutral: {
    background: "rgba(43,37,48,0.06)",
    color: "#8a8190",
    border: "1px solid rgba(43,37,48,0.10)",
  },
  success: {
    background: "var(--success-light)",
    color: "var(--success)",
    border: "1px solid rgba(61,139,110,0.20)",
  },
  warning: {
    background: "var(--warning-light)",
    color: "var(--warning)",
    border: "1px solid rgba(184,124,30,0.20)",
  },
  danger: {
    background: "var(--error-light)",
    color: "var(--error)",
    border: "1px solid rgba(190,74,74,0.20)",
  },
  info: {
    background: "var(--info-light)",
    color: "var(--info)",
    border: "1px solid rgba(59,122,181,0.20)",
  },
};

export function StatusBadge({
  tone = "neutral",
  className,
  style,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        className,
      )}
      style={{ ...toneStyles[tone], ...style }}
      {...props}
    />
  );
}
