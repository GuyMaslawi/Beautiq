"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChargeOutcomeFilter, ChargeKindFilter } from "@/server/admin/charge-queries";

const OUTCOMES: { value: ChargeOutcomeFilter; label: string }[] = [
  { value: "all", label: "הכול" },
  { value: "paid", label: "שולם" },
  { value: "failed", label: "נכשל" },
];

const KINDS: { value: ChargeKindFilter; label: string }[] = [
  { value: "all", label: "הכול" },
  { value: "first", label: "רכישה ראשונה" },
  { value: "recurring", label: "חידוש חודשי" },
];

/**
 * Filters for the billing ledger. State lives entirely in the URL so a filtered
 * view can be shared or reloaded, and so the server component re-runs the query
 * (rather than the table filtering a partial page client-side).
 */
export function ChargesFilters({
  outcome,
  kind,
  q,
}: {
  outcome: ChargeOutcomeFilter;
  kind: ChargeKindFilter;
  q: string;
}) {
  const router = useRouter();

  const go = (next: Partial<{ outcome: string; kind: string; q: string }>) => {
    const params = new URLSearchParams();
    const merged = { outcome, kind, q, ...next };
    if (merged.outcome && merged.outcome !== "all") params.set("outcome", merged.outcome);
    if (merged.kind && merged.kind !== "all") params.set("kind", merged.kind);
    if (merged.q) params.set("q", merged.q);
    const qs = params.toString();
    router.push(qs ? `/admin/subscriptions?${qs}` : "/admin/subscriptions");
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-4">
        <FilterGroup label="תוצאה">
          {OUTCOMES.map((o) => (
            <Chip
              key={o.value}
              active={outcome === o.value}
              onClick={() => go({ outcome: o.value })}
            >
              {o.label}
            </Chip>
          ))}
        </FilterGroup>

        <FilterGroup label="סוג">
          {KINDS.map((k) => (
            <Chip key={k.value} active={kind === k.value} onClick={() => go({ kind: k.value })}>
              {k.label}
            </Chip>
          ))}
        </FilterGroup>
      </div>

      <form
        className="relative sm:w-72"
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("q");
          go({ q: typeof value === "string" ? value.trim() : "" });
        }}
      >
        <Search className="text-muted pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
        <input
          name="q"
          defaultValue={q}
          placeholder="חיפוש לפי שם, אימייל או עסק"
          aria-label="חיפוש בלוג הרכישות"
          className="border-border bg-surface text-foreground placeholder:text-muted w-full rounded-xl border py-2 pr-9 pl-3 text-sm"
        />
      </form>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted text-xs font-medium">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-border text-muted hover:text-foreground rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active && "border-primary/40 bg-primary/10 text-primary",
      )}
    >
      {children}
    </button>
  );
}
