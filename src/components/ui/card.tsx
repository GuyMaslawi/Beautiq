import * as React from "react";
import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

/** כרטיס בסיסי — משטח רך עם פינות מעוגלות וצל עדין. */
export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-card border-border rounded-2xl border p-6 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
