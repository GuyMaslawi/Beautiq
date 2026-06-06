import * as React from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "tinted" | "flat";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variantStyles: Record<CardVariant, { className: string; style?: React.CSSProperties }> = {
  default: {
    className: "bg-surface border border-border",
    style: { boxShadow: "0 1px 4px rgba(43,37,48,0.06), 0 1px 2px rgba(43,37,48,0.04)" },
  },
  tinted: {
    className: "border",
    style: {
      background: "linear-gradient(135deg, rgba(247,238,243,0.8) 0%, rgba(247,232,243,0.6) 100%)",
      borderColor: "rgba(184,107,140,0.20)",
    },
  },
  flat: {
    className: "border-transparent border",
    style: { background: "var(--background-alt)" },
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
