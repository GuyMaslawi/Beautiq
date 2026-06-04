import Link from "next/link";
import { DASHBOARD } from "@/lib/constants/he";
import { Card } from "@/components/ui/card";

/**
 * State B — the business exists. A calm, guided checklist of recommended next
 * steps (CLAUDE.md §8, §19). These are guided-setup links into placeholder
 * pages for now; the underlying modules arrive in later phases.
 */
const ITEMS: { label: string; href: string }[] = [
  { label: DASHBOARD.checklist.items.categories, href: "/settings" },
  { label: DASHBOARD.checklist.items.service, href: "/services" },
  { label: DASHBOARD.checklist.items.availability, href: "/availability" },
  { label: DASHBOARD.checklist.items.profile, href: "/settings" },
  { label: DASHBOARD.checklist.items.publicLink, href: "/settings" },
];

export function SetupChecklist() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          {DASHBOARD.checklist.title}
        </h1>
        <p className="text-muted mt-1 leading-7">
          {DASHBOARD.checklist.subtitle}
        </p>
      </div>

      <Card className="p-0">
        <ul className="divide-border divide-y">
          {ITEMS.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="hover:bg-background flex items-center justify-between gap-4 px-5 py-4 transition-colors"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="border-border text-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs"
                  >
                    ✓
                  </span>
                  <span className="text-foreground truncate font-medium">
                    {item.label}
                  </span>
                </div>
                <span className="bg-background text-muted shrink-0 rounded-full px-2.5 py-1 text-xs">
                  {DASHBOARD.checklist.soon}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
