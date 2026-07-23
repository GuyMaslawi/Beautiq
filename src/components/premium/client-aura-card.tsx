import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LuxuryStatusPill } from "./status-pill";
import { tone as toneMap, type ToneKey } from "./tokens";

export interface AuraStat {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

/**
 * ClientAuraCard — warm relationship card. Gradient initials medallion with a
 * status aura ring, name + contact, a micro-stats row, optional warning badges
 * and an inline action bar. Used in the clients list and bring-back hub.
 */
interface ClientAuraCardProps {
  name: string;
  /** Optional small icon rendered right after the name (e.g. plan tier). */
  nameIcon?: React.ReactNode;
  contact?: string;
  initials: string;
  href?: string;
  statusTone?: ToneKey;
  statusLabel?: string;
  statusDot?: boolean;
  stats?: AuraStat[];
  badges?: React.ReactNode;
  /** highlighted line, e.g. upcoming appointment chip */
  highlight?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function ClientAuraCard({
  name,
  nameIcon,
  contact,
  initials,
  href,
  statusTone = "brand",
  statusLabel,
  statusDot,
  stats,
  badges,
  highlight,
  actions,
  className,
}: ClientAuraCardProps) {
  const c = toneMap[statusTone];
  const titleInner = (
    <>
      <div className="flex items-center gap-1.5">
        <p className="text-foreground truncate text-[15px] font-bold">{name}</p>
        {nameIcon}
      </div>
      {contact && (
        <p className="truncate text-xs" style={{ color: "var(--muted)" }} dir="ltr">
          {contact}
        </p>
      )}
    </>
  );
  return (
    <div
      className={cn(
        "lift relative overflow-hidden rounded-[1.35rem] p-4",
        className,
      )}
      style={{
        background: "linear-gradient(170deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.82) 100%)",
        border: "1px solid rgba(172,92,127,0.14)",
        boxShadow: "0 6px 20px -10px rgba(124,58,97,0.16), inset 0 1px 0 rgba(255,255,255,0.9)",
      }}
    >
      <div className="flex items-start gap-3.5">
        {/* medallion with status aura ring */}
        <div className="relative shrink-0">
          <span
            aria-hidden
            className="absolute -inset-1 rounded-full opacity-70"
            style={{ background: `radial-gradient(circle, ${c.glow} 0%, transparent 70%)`, filter: "blur(6px)" }}
          />
          <span
            className="relative flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #c76f93 0%, #ac5c7f 55%, #92609f 100%)",
              boxShadow: "0 6px 16px -6px rgba(172,92,127,0.6)",
            }}
          >
            {initials}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {href ? (
              <Link href={href} className="min-w-0 hover:underline">
                {titleInner}
              </Link>
            ) : (
              <div className="min-w-0">{titleInner}</div>
            )}
            {statusLabel && (
              <LuxuryStatusPill tone={statusTone} dot={statusDot} className="shrink-0">
                {statusLabel}
              </LuxuryStatusPill>
            )}
          </div>

          {badges && <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div>}
        </div>
      </div>

      {stats && stats.length > 0 && (
        <div className="mt-3.5 grid grid-cols-3 gap-2">
          {stats.map((s, i) => (
            <div
              key={i}
              className="rounded-xl px-2 py-2 text-center"
              style={{ background: "rgba(247,238,243,0.5)", border: "1px solid rgba(172,92,127,0.1)" }}
            >
              <div className="display-num text-foreground text-sm font-bold">{s.value}</div>
              <div className="mt-0.5 text-[10px] leading-tight" style={{ color: "var(--muted)" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {highlight && <div className="mt-3">{highlight}</div>}

      {actions && (
        <div className="mt-3.5 flex items-center gap-2 border-t pt-3" style={{ borderColor: "rgba(172,92,127,0.12)" }}>
          {actions}
        </div>
      )}
    </div>
  );
}
