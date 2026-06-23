import * as React from "react";
import { cn } from "@/lib/utils";
import { tintAura, type Tint } from "./tokens";

/**
 * PremiumPageShell — per-page ambient wrapper.
 * Sets a page-specific aura tint behind the whole route and applies a
 * consistent max-width + vertical rhythm. Replaces ad-hoc
 * `mx-auto max-w-* space-y-*` page roots so every page shares the same
 * editorial container while choosing its own ambient color.
 */
interface PremiumPageShellProps {
  tint?: Tint;
  /** content max width */
  width?: "narrow" | "default" | "wide" | "xwide" | "full";
  /** vertical gap between top-level sections */
  gap?: "default" | "loose";
  className?: string;
  children: React.ReactNode;
}

const widthMap = {
  narrow: "max-w-3xl",
  default: "max-w-5xl",
  wide: "max-w-6xl",
  xwide: "max-w-7xl",
  full: "max-w-none",
} as const;

export function PremiumPageShell({
  tint = "blush",
  width = "wide",
  gap = "default",
  className,
  children,
}: PremiumPageShellProps) {
  return (
    <div
      className="aura-surface"
      style={{ ["--page-aura" as string]: tintAura[tint] }}
    >
      <div
        className={cn(
          "mx-auto w-full",
          widthMap[width],
          gap === "loose" ? "space-y-10 md:space-y-12" : "space-y-7 md:space-y-9",
          className,
        )}
        dir="rtl"
      >
        {children}
      </div>
    </div>
  );
}
