import * as React from "react";
import { cn } from "@/lib/utils";
import { tintAccent, type Tint } from "./tokens";

/**
 * EditorialSectionHeader — open, un-boxed section title with an eyebrow
 * index/kicker, a title, optional supporting line + action, and a hairline
 * rule. Gives pages editorial rhythm instead of every section being a box.
 */
interface EditorialSectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  tint?: Tint;
  className?: string;
}

export function EditorialSectionHeader({
  eyebrow,
  title,
  description,
  icon,
  action,
  tint = "blush",
  className,
}: EditorialSectionHeaderProps) {
  const accent = tintAccent[tint];
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1.5 flex items-center gap-2">
              {icon && <span style={{ color: accent }}>{icon}</span>}
              <span className="eyebrow" style={{ color: accent }}>
                {eyebrow}
              </span>
            </div>
          )}
          <h2 className="text-foreground text-xl font-bold tracking-tight md:text-[1.4rem]">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm leading-6" style={{ color: "var(--muted)" }}>
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0 pb-1">{action}</div>}
      </div>
      <div className="editorial-rule" />
    </div>
  );
}
