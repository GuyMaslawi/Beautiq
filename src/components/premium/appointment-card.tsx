import * as React from "react";
import { cn } from "@/lib/utils";
import { tone as toneMap, type ToneKey } from "./tokens";

/**
 * AppointmentTimelineCard — premium booking item with a left time-rail,
 * client medallion, service line and a status pill. Designed to be stacked
 * inside a day group (the rail visually threads a timeline). Used in the
 * bookings list, dashboard "today" and the calendar detail panel.
 */
interface AppointmentTimelineCardProps {
  time: string;
  endTime?: string;
  clientName: string;
  initials: string;
  serviceName?: string;
  meta?: React.ReactNode;
  statusTone?: ToneKey;
  statusLabel?: string;
  price?: React.ReactNode;
  actions?: React.ReactNode;
  href?: string;
  /** show the connecting timeline rail (inside a grouped day list) */
  rail?: boolean;
  dim?: boolean;
  className?: string;
}

export function AppointmentTimelineCard({
  time,
  endTime,
  clientName,
  initials,
  serviceName,
  meta,
  statusTone = "brand",
  statusLabel,
  price,
  actions,
  href,
  rail = true,
  dim,
  className,
}: AppointmentTimelineCardProps) {
  const c = toneMap[statusTone];
  return (
    <div className={cn("relative flex gap-3.5", dim && "opacity-65", className)}>
      {/* time rail */}
      <div className="relative flex w-14 shrink-0 flex-col items-center">
        <div className="display-num text-foreground text-sm font-bold leading-none">{time}</div>
        {endTime && (
          <div className="mt-0.5 text-[10px]" style={{ color: "var(--muted)" }}>
            {endTime}
          </div>
        )}
        {rail && (
          <>
            <span
              className="mt-2 h-2.5 w-2.5 rounded-full"
              style={{ background: c.fg, boxShadow: `0 0 0 4px ${c.bg}` }}
            />
            <span
              aria-hidden
              className="mt-1 w-px flex-1"
              style={{ background: "linear-gradient(to bottom, rgba(184,107,140,0.3), transparent)" }}
            />
          </>
        )}
      </div>

      {/* card */}
      <div
        className={cn("lift mb-3 min-w-0 flex-1 overflow-hidden rounded-[1.2rem] p-3.5")}
        style={{
          background: "linear-gradient(170deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)",
          border: `1px solid ${c.border}`,
          boxShadow: "0 5px 18px -10px rgba(124,58,97,0.16), inset 0 1px 0 rgba(255,255,255,0.9)",
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg,#c97898,#9d6aa8)" }}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-foreground truncate text-[15px] font-bold">
                {href ? (
                  <a href={href} className="hover:underline">
                    {clientName}
                  </a>
                ) : (
                  clientName
                )}
              </p>
              {statusLabel && (
                <span
                  className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ color: c.fg, background: c.bg, border: `1px solid ${c.border}` }}
                >
                  {statusLabel}
                </span>
              )}
            </div>
            {serviceName && (
              <p className="truncate text-[13px]" style={{ color: "var(--foreground-soft)" }}>
                {serviceName}
              </p>
            )}
            {meta && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--muted)" }}>
                {meta}
              </div>
            )}
          </div>
          {price !== undefined && (
            <div className="display-num shrink-0 text-sm font-bold text-foreground" dir="ltr">
              {price}
            </div>
          )}
        </div>
        {actions && (
          <div className="mt-3 flex items-center justify-end gap-2 border-t pt-2.5" style={{ borderColor: "rgba(184,107,140,0.1)" }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
