import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * AuraBlob — decorative animated glow blob for heroes / empty states.
 * Pure CSS (no JS); animation auto-disabled under prefers-reduced-motion.
 */
interface AuraBlobProps {
  color?: string;
  size?: number;
  className?: string;
  /** disable drift animation (purely static glow) */
  still?: boolean;
  style?: React.CSSProperties;
}

export function AuraBlob({
  color = "rgba(199,111,147,0.30)",
  size = 320,
  className,
  still,
  style,
}: AuraBlobProps) {
  return (
    <div
      aria-hidden
      className={cn(still ? "" : "aura-blob", className)}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        position: "absolute",
        borderRadius: 9999,
        pointerEvents: "none",
        filter: "blur(40px)",
        ...style,
      }}
    />
  );
}
