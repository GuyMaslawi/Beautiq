"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/**
 * iOS/Android-style toggle switch.
 * Track: 44×24px  Thumb: 20×20px  Padding: 2px
 * RTL-aware: OFF = thumb on inline-start side, ON = thumb on inline-end side.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: SwitchProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        // Track: 44×24px
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full",
        "transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86b8c] focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? "[background:linear-gradient(135deg,#c97898_0%,#b86b8c_100%)]"
          : "bg-[var(--border)]",
        className,
      )}
    >
      {/* Thumb: 20×20px, 2px padding. RTL: start-side = inline-start (right in RTL). */}
      <span
        aria-hidden
        className={cn(
          // Thumb: 20×20px, vertically centred (top-0.5 = 2px)
          "absolute top-0.5 h-5 w-5 rounded-full bg-white",
          "transition-transform duration-200 ease-in-out",
          // OFF: thumb at inline-start edge (right in RTL)  → start-0.5 = 2px from start
          // ON:  translate toward inline-end (left in RTL)  → -translate-x-5 = -20px
          checked
            ? "start-0.5 -translate-x-5"
            : "start-0.5 translate-x-0",
        )}
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.20)" }}
      />
    </button>
  );
}
