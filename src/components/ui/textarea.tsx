import * as React from "react";
import { cn } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/** אזור טקסט בסיסי. RTL כברירת מחדל, בעיצוב תואם לשדה הקלט. */
export function Textarea({ className, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        "bg-surface border-border text-foreground placeholder:text-muted focus:border-primary w-full rounded-xl border px-4 py-3 text-base outline-none transition-colors",
        className,
      )}
      {...props}
    />
  );
}
