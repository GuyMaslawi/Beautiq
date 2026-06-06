import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "text-white active:scale-[0.98] disabled:opacity-50",
  secondary:
    "bg-surface text-foreground border border-border hover:bg-background-alt active:scale-[0.98] disabled:opacity-50",
  ghost:
    "bg-transparent text-muted hover:text-foreground hover:bg-background-alt disabled:opacity-50",
  destructive:
    "text-white hover:opacity-90 active:scale-[0.98] disabled:opacity-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm rounded-xl",
  md: "h-11 px-5 text-base rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  style,
  ...props
}: ButtonProps) {
  const isPrimary = variant === "primary";
  const isDestructive = variant === "destructive";

  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      style={
        isPrimary
          ? {
              background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
              boxShadow: "0 1px 6px rgba(184,107,140,0.28), inset 0 1px 0 rgba(255,255,255,0.15)",
              ...style,
            }
          : isDestructive
            ? {
                background: "linear-gradient(135deg, #c85a5a 0%, #be4a4a 100%)",
                boxShadow: "0 1px 4px rgba(190,74,74,0.20)",
                ...style,
              }
            : style
      }
      {...props}
    />
  );
}
