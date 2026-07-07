import * as React from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "tinted" | "flat" | "glass";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variantStyles: Record<CardVariant, { className: string; style?: React.CSSProperties }> = {
  default: {
    className: "bg-surface border border-border",
    style: { boxShadow: "0 2px 10px rgba(124,58,97,0.07), 0 1px 3px rgba(124,58,97,0.05)" },
  },
  tinted: {
    className: "border",
    style: {
      background: "linear-gradient(135deg, rgba(247,238,243,0.85) 0%, rgba(243,238,246,0.65) 100%)",
      borderColor: "rgba(172,92,127,0.20)",
      boxShadow: "0 2px 10px rgba(124,58,97,0.06)",
    },
  },
  flat: {
    className: "border-transparent border",
    style: { background: "var(--background-alt)" },
  },
  // Translucent, blurred glass — soft luxury surface
  glass: {
    className: "glass-card",
  },
};

export function Card({ className, variant = "default", style, ...props }: CardProps) {
  const config = variantStyles[variant];
  return (
    <div
      className={cn("rounded-2xl p-6", config.className, className)}
      style={{ ...config.style, ...style }}
      {...props}
    />
  );
}
