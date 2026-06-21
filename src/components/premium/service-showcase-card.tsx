import * as React from "react";
import { cn } from "@/lib/utils";
import { tintGradient, type Tint } from "./tokens";

/**
 * ServiceShowcaseCard — curated service card with an editorial price
 * treatment, a duration chip, an optional pricing-health glance and slots for
 * a toggle / action. Used in the admin services grid and (lighter) on the
 * public booking service selection.
 */
interface ServiceShowcaseCardProps {
  name: string;
  description?: string | null;
  /** formatted price block, e.g. ₪180 */
  price?: React.ReactNode;
  priceNote?: string;
  duration?: React.ReactNode;
  icon?: React.ReactNode;
  tint?: Tint;
  /** top-right control (e.g. active toggle) */
  control?: React.ReactNode;
  /** pricing-health / insight glance row */
  insight?: React.ReactNode;
  footer?: React.ReactNode;
  inactive?: boolean;
  selected?: boolean;
  className?: string;
  /** make the whole header a clickable region */
  onSelect?: () => void;
}

export function ServiceShowcaseCard({
  name,
  description,
  price,
  priceNote,
  duration,
  icon,
  tint = "champagne",
  control,
  insight,
  footer,
  inactive,
  selected,
  className,
  onSelect,
}: ServiceShowcaseCardProps) {
  return (
    <div
      className={cn(
        "lift group relative flex flex-col overflow-hidden rounded-[1.4rem]",
        inactive && "opacity-70",
        className,
      )}
      style={{
        background: "linear-gradient(168deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.84) 100%)",
        border: selected ? "1.5px solid rgba(184,107,140,0.5)" : "1px solid rgba(184,107,140,0.14)",
        boxShadow: selected
          ? "0 16px 40px -16px rgba(124,58,97,0.26)"
          : "0 8px 24px -12px rgba(124,58,97,0.15), inset 0 1px 0 rgba(255,255,255,0.9)",
      }}
    >
      {/* header band with soft tint */}
      <div
        className="relative p-5"
        style={{ background: "linear-gradient(135deg, rgba(247,241,232,0.7) 0%, rgba(247,238,243,0.4) 100%)" }}
        {...(onSelect ? { role: "button", onClick: onSelect, tabIndex: 0 } : {})}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{ background: tintGradient[tint], boxShadow: "0 8px 18px -6px rgba(168,124,66,0.45)" }}
            >
              {icon ?? <span className="text-lg">✦</span>}
            </span>
            <div className="min-w-0">
              <h3 className="text-foreground truncate text-[16px] font-bold tracking-tight">{name}</h3>
              {description && (
                <p className="mt-0.5 line-clamp-2 text-[13px] leading-5" style={{ color: "var(--muted)" }}>
                  {description}
                </p>
              )}
            </div>
          </div>
          {control && <div className="shrink-0">{control}</div>}
        </div>
      </div>

      {/* price + duration strip */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
          {duration}
        </div>
        {price !== undefined && (
          <div className="text-left" dir="ltr">
            <span className="display-num text-xl font-bold" style={{ color: "#b86b8c" }}>
              {price}
            </span>
            {priceNote && (
              <span className="ms-1 text-[11px]" style={{ color: "var(--muted)" }}>
                {priceNote}
              </span>
            )}
          </div>
        )}
      </div>

      {insight && (
        <div className="border-t px-5 py-3" style={{ borderColor: "rgba(184,107,140,0.1)" }}>
          {insight}
        </div>
      )}
      {footer && (
        <div className="mt-auto border-t px-5 py-3" style={{ borderColor: "rgba(184,107,140,0.1)" }}>
          {footer}
        </div>
      )}
    </div>
  );
}
