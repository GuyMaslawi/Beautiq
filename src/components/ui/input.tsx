import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  iconRight?: React.ReactNode;
};

export function Input({ className, type = "text", iconRight, ...props }: InputProps) {
  const inputEl = (
    <input
      type={type}
      className={cn(
        "bg-surface border-border text-foreground placeholder:text-muted-light h-12 w-full rounded-xl border px-4 text-base outline-none",
        "transition-all duration-200",
        "focus:border-primary focus:ring-2 focus:ring-primary/20",
        "hover:border-border-strong",
        iconRight ? "pr-10" : "",
        className,
      )}
      {...props}
    />
  );

  if (!iconRight) return inputEl;

  return (
    <div className="relative">
      {inputEl}
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-light">
        {iconRight}
      </div>
    </div>
  );
}
