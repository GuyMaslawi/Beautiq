import * as React from "react";
import { cn } from "@/lib/utils";
import { tone as toneMap, type ToneKey } from "./tokens";

/**
 * LuxuryStatusPill — refined status pill. `soft` (default) is a tinted
 * outline chip; `solid` fills with the tone gradient for emphatic states.
 * Superset of StatusBadge / BookingStatusBadge tones.
 */
interface LuxuryStatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: ToneKey;
  variant?: "soft" | "solid";
  icon?: React.ReactNode;
  /** pulsing dot before the label (for live/ready states) */
  dot?: boolean;
}

export function LuxuryStatusPill({
  tone = "neutral",
  variant = "soft",
  icon,
  dot,
  className,
  children,
  ...rest
}: LuxuryStatusPillProps) {
  const c = toneMap[tone];
  const solid = variant === "solid";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        className,
      )}
      style={{
        color: solid ? "#fff" : c.fg,
        background: solid
          ? `linear-gradient(135deg, ${c.fg}, ${c.fg}cc)`
          : c.bg,
        border: `1px solid ${solid ? "transparent" : c.border}`,
        boxShadow: solid ? `0 4px 12px -4px ${c.glow}` : "none",
      }}
      {...rest}
    >
      {dot && (
        <span
          className="relative flex h-1.5 w-1.5"
          aria-hidden
        >
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
            style={{ background: solid ? "#fff" : c.fg }}
          />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: solid ? "#fff" : c.fg }} />
        </span>
      )}
      {icon && <span className="flex">{icon}</span>}
      {children}
    </span>
  );
}
