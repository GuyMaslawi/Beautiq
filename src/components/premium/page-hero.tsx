import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuraBlob } from "./aura-blob";
import { StatRibbon, type RibbonStat } from "./stat-ribbon";
import { tintAccent, tintGradient, type Tint } from "./tokens";

/**
 * BeautyPageHero — distinctive editorial page header (replaces PageHeader).
 * Asymmetric composition: eyebrow + oversized title + supporting line on the
 * lead side; primary action and/or a live stat ribbon on the trailing side.
 * A soft aura glow sits behind the title and a gradient hairline closes it.
 *
 * Superset of PageHeader's props (icon/title/subtitle/action) plus
 * eyebrow, stats and tint.
 */
interface BeautyPageHeroProps {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  stats?: RibbonStat[];
  tint?: Tint;
  className?: string;
  /** extra decorative content rendered on the trailing side (above action) */
  aside?: React.ReactNode;
}

export function BeautyPageHero({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  action,
  stats,
  tint = "blush",
  className,
  aside,
}: BeautyPageHeroProps) {
  const accent = tintAccent[tint];
  return (
    <header
      className={cn("spotlight relative isolate overflow-hidden rounded-[1.75rem]", className)}
      style={{
        background:
          "linear-gradient(165deg, rgba(255,255,255,0.86) 0%, rgba(255,255,255,0.58) 100%)",
        border: "1px solid rgba(255,255,255,0.7)",
        boxShadow: "0 18px 48px -18px rgba(124,58,97,0.20), inset 0 1px 0 rgba(255,255,255,0.9)",
        backdropFilter: "blur(14px) saturate(1.3)",
        WebkitBackdropFilter: "blur(14px) saturate(1.3)",
      }}
    >
      <AuraBlob
        color="rgba(201,120,152,0.22)"
        size={360}
        style={{ top: -180, insetInlineEnd: -80 }}
      />
      <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-end md:justify-between md:p-8">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-3">
            {Icon && (
              <span
                className="ring-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: tintGradient[tint], boxShadow: `0 8px 20px -6px ${accent}66` }}
              >
                <Icon className="h-5 w-5 text-white" />
              </span>
            )}
            {eyebrow && (
              <span className="eyebrow" style={{ color: accent }}>
                {eyebrow}
              </span>
            )}
          </div>
          <h1 className="display-num text-foreground text-[2rem] font-bold md:text-[2.5rem]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2.5 max-w-xl text-sm leading-7 md:text-[15px]" style={{ color: "var(--muted)" }}>
              {subtitle}
            </p>
          )}
        </div>

        {(action || aside || stats) && (
          <div className="flex shrink-0 flex-col items-stretch gap-3 md:items-end">
            {aside}
            {stats && stats.length > 0 && <StatRibbon stats={stats} className="md:justify-end" />}
            {action && <div className="flex flex-wrap gap-2 md:justify-end">{action}</div>}
          </div>
        )}
      </div>
      <div className="editorial-rule mx-6 md:mx-8" />
    </header>
  );
}
