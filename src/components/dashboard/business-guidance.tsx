import { GUIDANCE } from "@/lib/constants/he";
import { GuidanceCard } from "@/components/dashboard/guidance-card";
import type { GuidanceItem } from "@/lib/guidance/rules";

export function BusinessGuidance({ items }: { items: GuidanceItem[] }) {
  return (
    <section>
      <h2 className="text-foreground mb-4 font-bold">
        {GUIDANCE.sectionTitle}
      </h2>

      {items.length === 0 ? (
        <div
          className="rounded-2xl border p-5 space-y-1"
          style={{
            borderColor: "rgba(61,139,110,0.2)",
            background: "rgba(61,139,110,0.05)",
            boxShadow: "var(--shadow-xs)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
              style={{ background: "rgba(61,139,110,0.12)", color: "#3d8b6e" }}
            >
              ✓
            </span>
            <p className="text-foreground font-semibold text-sm">
              {GUIDANCE.allClear.title}
            </p>
          </div>
          <p className="text-muted text-sm leading-6 pr-9">
            {GUIDANCE.allClear.body}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <GuidanceCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
