import Link from "next/link";
import { Radio } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PlatformActivityRow } from "@/server/admin/platform-analytics";
import type { ActivityCategory, ActivityActorType } from "@prisma/client";

const CATEGORY_META: Record<ActivityCategory, { label: string; color: string }> = {
  auth: { label: "התחברות", color: "var(--mauve)" },
  booking: { label: "תורים", color: "var(--success)" },
  client: { label: "לקוחות", color: "var(--primary)" },
  service: { label: "שירותים", color: "var(--accent)" },
  availability: { label: "זמינות", color: "var(--info)" },
  settings: { label: "הגדרות", color: "var(--muted)" },
  finance: { label: "פיננסים", color: "var(--warning)" },
  automation: { label: "אוטומציה", color: "var(--info)" },
  campaign: { label: "קמפיינים", color: "var(--accent)" },
  loyalty: { label: "נאמנות", color: "var(--primary)" },
  subscription: { label: "מנוי", color: "var(--success)" },
  admin: { label: "אדמין", color: "var(--error)" },
  other: { label: "אחר", color: "var(--muted)" },
};

const ACTOR_LABELS: Record<ActivityActorType, string> = {
  owner: "בעלת העסק",
  admin: "מנהל",
  system: "מערכת",
  client: "לקוחה",
};

function timeHe(d: Date): string {
  return new Date(d).toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PlatformActivityFeed({ rows }: { rows: PlatformActivityRow[] }) {
  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-2">
        <Radio className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
          פעילות אחרונה במערכת
        </h2>
      </div>
      <p className="mb-4 text-xs text-muted">
        זרם חי של כל הפעולות מכל העסקים — מתחיל להצטבר מרגע ההפעלה.
      </p>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          עדיין לא תועדו פעולות. ברגע שמשתמשים יתחילו לפעול, הכל יופיע כאן.
        </p>
      ) : (
        <ul className="space-y-0">
          {rows.map((r) => {
            const meta = CATEGORY_META[r.category];
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 border-b border-border/50 py-2.5 last:border-0"
              >
                <span
                  className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: "var(--background-alt)", color: meta.color }}
                >
                  {meta.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{r.summary}</p>
                  <p className="truncate text-xs text-muted">
                    {ACTOR_LABELS[r.actorType]}
                    {r.businessName && (
                      <>
                        {" · "}
                        {r.businessId ? (
                          <Link
                            href={`/admin/businesses/${r.businessId}`}
                            className="hover:text-primary hover:underline"
                          >
                            {r.businessName}
                          </Link>
                        ) : (
                          r.businessName
                        )}
                      </>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {timeHe(r.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
