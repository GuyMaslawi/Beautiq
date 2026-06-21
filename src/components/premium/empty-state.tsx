import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AuraBlob } from "./aura-blob";
import { tintGradient, type Tint } from "./tokens";

/**
 * PremiumEmptyState — editorial empty state with a floating layered icon
 * "constellation", headline, body and CTA. Superset of EmptyState props
 * (title/body/cta/ctaHref/icon) plus tint, secondary action and orbit icons.
 */
interface PremiumEmptyStateProps {
  title: string;
  body: string;
  cta?: string;
  ctaHref?: string;
  ctaAction?: React.ReactNode;
  icon?: React.ReactNode;
  /** small decorative icons floating around the central medallion */
  orbit?: React.ReactNode[];
  tint?: Tint;
  className?: string;
}

export function PremiumEmptyState({
  title,
  body,
  cta,
  ctaHref,
  ctaAction,
  icon,
  orbit,
  tint = "blush",
  className,
}: PremiumEmptyStateProps) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[1.75rem] px-6 py-16 text-center",
        className,
      )}
      style={{
        background:
          "linear-gradient(165deg, rgba(255,255,255,0.9) 0%, rgba(250,244,248,0.7) 60%, rgba(255,255,255,0.96) 100%)",
        border: "1px solid rgba(255,255,255,0.7)",
        boxShadow: "0 16px 44px -20px rgba(124,58,97,0.18), inset 0 1px 0 rgba(255,255,255,0.9)",
      }}
    >
      <AuraBlob color="rgba(201,120,152,0.20)" size={260} style={{ top: -90, left: "50%", marginLeft: -130 }} />

      <div className="relative mx-auto mb-6 flex h-[88px] w-[88px] items-center justify-center">
        {/* orbiting decorative icons */}
        {orbit?.slice(0, 3).map((o, i) => (
          <span
            key={i}
            className="float-slow absolute flex h-8 w-8 items-center justify-center rounded-xl text-[var(--muted)]"
            style={{
              background: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(184,107,140,0.16)",
              boxShadow: "0 4px 12px rgba(124,58,97,0.08)",
              ...[
                { top: -6, insetInlineStart: -10 },
                { bottom: 0, insetInlineEnd: -14 },
                { top: 8, insetInlineEnd: -2 },
              ][i],
              animationDelay: `${i * 0.8}s`,
            }}
          >
            {o}
          </span>
        ))}
        {/* central medallion */}
        <span
          className="ring-soft flex h-[72px] w-[72px] items-center justify-center rounded-[1.4rem] text-white"
          style={{ background: tintGradient[tint], boxShadow: "0 12px 28px -8px rgba(184,107,140,0.5)" }}
        >
          {icon ?? <span className="text-2xl" aria-hidden>✦</span>}
        </span>
      </div>

      <h2 className="text-foreground relative text-xl font-bold tracking-tight">{title}</h2>
      <p className="text-muted relative mx-auto mt-3 max-w-sm text-sm leading-7">{body}</p>

      {(ctaAction || (cta && ctaHref)) && (
        <div className="relative mt-7 flex justify-center">
          {ctaAction ?? (
            <Link href={ctaHref!}>
              <Button size="lg">{cta}</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
