import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * FloatingActionPanel — premium quick-actions surface.
 * On mobile it pins to the bottom as a glass action bar; on desktop it floats
 * as a rounded glass pill (bottom-trailing by default, or inline if `inline`).
 * Purely presentational — pass action buttons/links as children.
 */
interface FloatingActionPanelProps {
  children: React.ReactNode;
  /** label shown on the leading side of the bar */
  label?: React.ReactNode;
  /** render inline (in flow) instead of floating/fixed */
  inline?: boolean;
  className?: string;
}

export function FloatingActionPanel({
  children,
  label,
  inline,
  className,
}: FloatingActionPanelProps) {
  return (
    <div
      className={cn(
        inline
          ? "relative w-full"
          : "fixed inset-x-3 bottom-3 z-40 md:inset-x-auto md:bottom-6 md:end-6",
        className,
      )}
    >
      <div
        className="ring-soft flex items-center gap-2 rounded-[1.25rem] px-3 py-2.5"
        style={{
          background: "rgba(255,255,255,0.82)",
          boxShadow: "0 16px 40px -14px rgba(124,58,97,0.3), inset 0 1px 0 rgba(255,255,255,0.9)",
          backdropFilter: "blur(16px) saturate(1.4)",
          WebkitBackdropFilter: "blur(16px) saturate(1.4)",
        }}
      >
        {label && (
          <span className="me-1 hidden text-xs font-semibold md:inline" style={{ color: "var(--muted)" }}>
            {label}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}
