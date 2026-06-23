/*
 * Shared presentational primitives for the design lab.
 * Pure visual — no data fetching, no app logic. Reused across concepts.
 */
import { cn } from "@/lib/utils";

const toneGrad: Record<string, string> = {
  blush: "var(--lab-grad-blush)",
  gold: "var(--lab-grad-gold)",
  rose: "var(--lab-grad-rose)",
  orchid: "var(--lab-grad-orchid)",
  live: "var(--lab-grad-rose)",
};

const toneInk: Record<string, string> = {
  blush: "#3a1226",
  gold: "#2a1228",
  rose: "#3a1226",
  orchid: "#1d0e1c",
  live: "#0c2a20",
};

export function Avatar({
  initials,
  tone = "blush",
  size = 44,
  ring = true,
}: {
  initials: string;
  tone?: string;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      className={cn(
        "lab-serif inline-grid place-items-center rounded-full font-bold",
        ring && "ring-1 ring-[rgba(236,217,175,0.35)]",
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: toneGrad[tone] ?? toneGrad.blush,
        color: toneInk[tone] ?? "#2a1228",
        boxShadow: "0 8px 22px -8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.4)",
      }}
    >
      {initials}
    </span>
  );
}

export function Pill({
  children,
  className,
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "neutral" | "gold" | "rose" | "live" | "alert";
}) {
  const map = {
    neutral: "lab-pill",
    gold: "border-[rgba(217,189,132,0.4)] text-[var(--lab-gold)] bg-[rgba(217,189,132,0.1)]",
    rose: "border-[rgba(231,169,196,0.4)] text-[var(--lab-rose)] bg-[rgba(231,169,196,0.1)]",
    live: "border-[rgba(111,224,176,0.4)] text-[var(--lab-live)] bg-[rgba(111,224,176,0.1)]",
    alert: "border-[rgba(242,163,94,0.4)] text-[var(--lab-alert)] bg-[rgba(242,163,94,0.1)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.7rem] font-medium",
        map[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <span
        className="lab-live-dot block rounded-full"
        style={{ width: 9, height: 9, background: "var(--lab-live)" }}
      />
    </span>
  );
}

// Champagne mini bar chart — the revenue pulse
export function Sparkbars({
  values,
  days,
  height = 64,
  accent = "gold",
}: {
  values: number[];
  days?: string[];
  height?: number;
  accent?: "gold" | "rose";
}) {
  const max = Math.max(...values);
  const grad = accent === "gold" ? "var(--lab-grad-gold)" : "var(--lab-grad-rose)";
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {values.map((v, i) => {
        const isPeak = v === max;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className="w-full rounded-full transition-all duration-500"
              style={{
                height: `${(v / max) * (height - (days ? 18 : 0))}px`,
                background: isPeak ? grad : "rgba(236,217,175,0.22)",
                boxShadow: isPeak ? "0 0 16px -2px rgba(217,189,132,0.55)" : "none",
              }}
            />
            {days && (
              <span className="text-[0.58rem] text-[var(--lab-pearl-faint)]">{days[i]}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Gold progress ring (revenue vs target)
export function Ring({
  value,
  max,
  size = 132,
  stroke = 8,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="labRingGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f4e6c4" />
            <stop offset="55%" stopColor="#d9bd84" />
            <stop offset="100%" stopColor="#e8b8a6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(236,217,175,0.12)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#labRingGold)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ filter: "drop-shadow(0 0 6px rgba(217,189,132,0.5))" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Eyebrow({
  children,
  he = false,
  className,
}: {
  children: React.ReactNode;
  he?: boolean;
  className?: string;
}) {
  return <div className={cn(he ? "lab-eyebrow-he" : "lab-eyebrow", className)}>{children}</div>;
}

// Currency
export function Shekel({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("lab-num", className)}>
      ₪{value.toLocaleString("he-IL")}
    </span>
  );
}
