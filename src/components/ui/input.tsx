import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * שדה קלט בסיסי. RTL כברירת מחדל (יורש מכיוון הדף),
 * עם מצב פוקוס ברור ועיצוב רך.
 */
export function Input({ className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "bg-surface border-border text-foreground placeholder:text-muted h-11 w-full rounded-xl border px-4 text-base outline-none transition-colors focus:border-primary",
        className,
      )}
      {...props}
    />
  );
}
