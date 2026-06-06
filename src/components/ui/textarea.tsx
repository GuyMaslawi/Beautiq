import * as React from "react";
import { cn } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/** אזור טקסט בסיסי. RTL כברירת מחדל, בעיצוב תואם לשדה הקלט. */
export function Textarea({ className, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        "bg-surface border-border text-foreground placeholder:text-muted-light h-auto w-full rounded-xl border px-4 py-3 text-base outline-none",
        "transition-all duration-150 focus:border-primary focus:ring-2 focus:ring-primary/15",
        className,
      )}
      {...props}
    />
  );
}
