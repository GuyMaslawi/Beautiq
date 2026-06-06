import Link from "next/link";
import { AlertCircle, Lightbulb, Info, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GUIDANCE } from "@/lib/constants/he";
import type { GuidanceItem, GuidancePriority } from "@/lib/guidance/rules";

const PRIORITY_CONFIG: Record<
  GuidancePriority,
  {
    badge: string;
    iconColor: string;
    border: string;
    bg: string;
    iconBg: string;
    Icon: typeof AlertCircle;
  }
> = {
  important: {
    badge: "bg-error-light text-error",
    iconColor: "var(--error)",
    border: "border-error/20",
    bg: "bg-error-light/30",
    iconBg: "rgba(190,74,74,0.10)",
    Icon: AlertCircle,
  },
  recommended: {
    badge: "bg-warning-light text-warning",
    iconColor: "var(--warning)",
    border: "border-warning/20",
    bg: "bg-warning-light/30",
    iconBg: "rgba(184,124,30,0.10)",
    Icon: Lightbulb,
  },
  info: {
    badge: "bg-info-light text-info",
    iconColor: "var(--info)",
    border: "border-info/20",
    bg: "bg-info-light/30",
    iconBg: "rgba(59,122,181,0.10)",
    Icon: Info,
  },
};

const PRIORITY_LABELS: Record<GuidancePriority, string> = {
  important: GUIDANCE.priority.important,
  recommended: GUIDANCE.priority.recommended,
  info: GUIDANCE.priority.info,
};

export function GuidanceCard({ item }: { item: GuidanceItem }) {
  const config = PRIORITY_CONFIG[item.priority];
  const { Icon } = config;

  return (
    <div
      className={`rounded-2xl border ${config.border} bg-surface p-4 space-y-3 transition-shadow hover:shadow-md`}
      style={{ boxShadow: "var(--shadow-xs)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Priority icon */}
          <div
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: config.iconBg }}
          >
            <Icon className="h-4 w-4" style={{ color: config.iconColor }} />
          </div>
          <p className="text-foreground font-semibold text-sm leading-snug min-w-0">
            {item.title}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${config.badge}`}
        >
          {PRIORITY_LABELS[item.priority]}
        </span>
      </div>
      <p className="text-muted text-sm leading-6 pr-11">{item.description}</p>
      <div className="pr-11">
        <Link href={item.href}>
          <Button variant="secondary" size="sm">
            {item.actionLabel}
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
