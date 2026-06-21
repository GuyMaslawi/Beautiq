import * as React from "react";
import { cn } from "@/lib/utils";
import { tone as toneMap, type ToneKey } from "./tokens";

/**
 * BeautyInsightCard — recommendation / insight surface.
 * Tinted aura by tone, a leading icon medallion, headline + body, an optional
 * value chip and an action slot. Used for dashboard opportunities, pricing
 * health, finance target-vs-actual, etc. `featured` enlarges it into a hero
 * band (for a single dominant insight on a page).
 */
interface BeautyInsightCardProps {
  tone?: ToneKey;
  icon?: React.ReactNode;
  eyebrow?: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  /** big emphasised value (e.g. ₪1,240) shown on the trailing side */
  value?: React.ReactNode;
  valueLabel?: string;
  action?: React.ReactNode;
  featured?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function BeautyInsightCard({
  tone = "brand",
  icon,
  eyebrow,
  title,
  body,
  value,
  valueLabel,
  action,
  featured,
  className,
  children,
}: BeautyInsightCardProps) {
  const c = toneMap[tone];
  return (
    <div
      className={cn(
        "lift relative overflow-hidden rounded-[1.5rem]",
        featured ? "p-6 md:p-7" : "p-5",
        className,
      )}
      style={{
        background: "linear-gradient(165deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.8) 100%)",
        border: `1px solid ${c.border}`,
        boxShadow: "0 12px 36px -16px rgba(124,58,97,0.20), inset 0 1px 0 rgba(255,255,255,0.9)",
      }}
    >
      {/* aura wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 rounded-full"
        style={{
          insetInlineEnd: "-3rem",
          width: featured ? 220 : 160,
          height: featured ? 220 : 160,
          background: `radial-gradient(circle, ${c.glow} 0%, transparent 70%)`,
          filter: "blur(14px)",
        }}
      />
      <div className="relative flex items-start gap-4">
        {icon && (
          <span
            className="flex shrink-0 items-center justify-center rounded-2xl"
            style={{
              width: featured ? 56 : 44,
              height: featured ? 56 : 44,
              background: c.bg,
              border: `1px solid ${c.border}`,
              color: c.fg,
            }}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <span className="eyebrow mb-1 block" style={{ color: c.fg }}>
              {eyebrow}
            </span>
          )}
          <h3
            className={cn(
              "text-foreground font-bold tracking-tight",
              featured ? "text-lg md:text-xl" : "text-[15px]",
            )}
          >
            {title}
          </h3>
          {body && (
            <div className="mt-1.5 text-sm leading-6" style={{ color: "var(--muted)" }}>
              {body}
            </div>
          )}
          {children}
        </div>
        {value !== undefined && (
          <div className="shrink-0 text-left" dir="ltr">
            <div className="display-num text-2xl font-bold" style={{ color: c.fg }}>
              {value}
            </div>
            {valueLabel && (
              <div className="text-[11px] font-medium" style={{ color: "var(--muted)" }} dir="rtl">
                {valueLabel}
              </div>
            )}
          </div>
        )}
      </div>
      {action && <div className="relative mt-4 flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}
