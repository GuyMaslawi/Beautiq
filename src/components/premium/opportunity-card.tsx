import * as React from "react";
import { cn } from "@/lib/utils";
import { tone as toneMap, type ToneKey } from "./tokens";

/**
 * GrowthOpportunityCard — the bring-back hero card. Frames each opportunity
 * around recoverable money: a client medallion, a "reason to reach out" line,
 * a value chip, a segment tag, and an action area that can expand in place
 * (the WhatsApp composer is passed as `expanded` and toggled by the parent).
 */
interface GrowthOpportunityCardProps {
  name: string;
  initials: string;
  reason: React.ReactNode;
  /** recoverable value, e.g. ₪180 */
  value?: React.ReactNode;
  valueLabel?: string;
  segment?: string;
  segmentTone?: ToneKey;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  /** expand-in-place content (e.g. message composer); render when open */
  expanded?: React.ReactNode;
  open?: boolean;
  className?: string;
}

export function GrowthOpportunityCard({
  name,
  initials,
  reason,
  value,
  valueLabel = "פוטנציאל",
  segment,
  segmentTone = "brand",
  meta,
  actions,
  expanded,
  open,
  className,
}: GrowthOpportunityCardProps) {
  const seg = toneMap[segmentTone];
  return (
    <div
      className={cn("lift relative overflow-hidden rounded-[1.4rem]", className)}
      style={{
        background: "linear-gradient(165deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.82) 100%)",
        border: open ? "1px solid rgba(172,92,127,0.34)" : "1px solid rgba(172,92,127,0.16)",
        boxShadow: open
          ? "0 18px 44px -16px rgba(124,58,97,0.26), inset 0 1px 0 rgba(255,255,255,0.9)"
          : "0 8px 24px -12px rgba(124,58,97,0.16), inset 0 1px 0 rgba(255,255,255,0.9)",
      }}
    >
      {/* value glow */}
      {value !== undefined && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 rounded-full"
          style={{
            insetInlineEnd: "-2rem",
            width: 150,
            height: 150,
            background: "radial-gradient(circle, rgba(199,111,147,0.18) 0%, transparent 70%)",
            filter: "blur(12px)",
          }}
        />
      )}
      <div className="relative p-4 md:p-5">
        <div className="flex items-start gap-3.5">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-bold text-white"
            style={{ background: "linear-gradient(135deg,#c76f93,#92609f)", boxShadow: "0 8px 18px -6px rgba(172,92,127,0.55)" }}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-foreground truncate text-base font-bold">{name}</p>
              {segment && (
                <span
                  className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{ color: seg.fg, background: seg.bg, border: `1px solid ${seg.border}` }}
                >
                  {segment}
                </span>
              )}
            </div>
            <div className="mt-1 text-[13px] leading-6" style={{ color: "var(--foreground-soft)" }}>
              {reason}
            </div>
            {meta && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--muted)" }}>
                {meta}
              </div>
            )}
          </div>
          {value !== undefined && (
            <div className="shrink-0 rounded-2xl px-3 py-2 text-center" style={{ background: "rgba(247,238,243,0.7)", border: "1px solid rgba(172,92,127,0.2)" }}>
              <div className="display-num text-lg font-bold" style={{ color: "#ac5c7f" }} dir="ltr">
                {value}
              </div>
              <div className="text-[10px] font-medium" style={{ color: "var(--muted)" }}>
                {valueLabel}
              </div>
            </div>
          )}
        </div>

        {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}

        {open && expanded && (
          <div className="mt-4 border-t pt-4" style={{ borderColor: "rgba(172,92,127,0.14)" }}>
            {expanded}
          </div>
        )}
      </div>
    </div>
  );
}
