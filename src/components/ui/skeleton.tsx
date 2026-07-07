import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton — בלוק טעינה עם שימר עדין בגוון המותג.
 * משמש במסכי loading.tsx ובכל מקום שבו תוכן נטען.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} aria-hidden {...props} />;
}
