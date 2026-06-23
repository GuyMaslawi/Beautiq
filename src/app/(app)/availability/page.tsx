import Link from "next/link";
import { Clock } from "lucide-react";
import { PremiumPageShell, BeautyPageHero } from "@/components/premium";
import { requireTenant } from "@/server/auth/session";
import { getWeeklyRules, getAvailabilityExceptions } from "@/server/availability/queries";
import { WeeklyAvailabilityForm } from "@/components/availability/weekly-availability-form";
import { AvailabilityExceptions } from "@/components/availability/availability-exceptions";
import { Button } from "@/components/ui/button";
import { AVAILABILITY } from "@/lib/constants/he";
import type { ExceptionRecord } from "@/components/availability/availability-exceptions";

export default async function AvailabilityPage() {
  const tenant = await requireTenant();

  const [rules, rawExceptions] = await Promise.all([
    getWeeklyRules(tenant),
    getAvailabilityExceptions(tenant),
  ]);

  const hasRules = rules.length > 0;

  // Serialise Date objects for client components
  const exceptions: ExceptionRecord[] = rawExceptions.map((e) => ({
    id: e.id,
    date: e.date.toISOString().slice(0, 10),
    type: e.type,
    startMinutes: e.startMinutes,
    endMinutes: e.endMinutes,
    reason: e.reason,
  }));

  return (
    <PremiumPageShell tint="mauve" width="wide">
      {/* Page header */}
      <BeautyPageHero
        icon={Clock}
        eyebrow="זמינות ושעות"
        title={AVAILABILITY.pageTitle}
        subtitle={AVAILABILITY.pageSubtitle}
        tint="mauve"
      />

      {/* Empty state guidance — shown only when no rules are configured yet */}
      {!hasRules && (
        <div className="aura-card grain ring-soft relative overflow-hidden rounded-[1.5rem] p-6 space-y-3">
          <div className="flex items-center gap-2.5">
            <span
              className="ring-soft flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--grad-mauve)" }}
            >
              <Clock className="h-4 w-4 text-white" />
            </span>
            <h2 className="text-foreground font-bold">
              {AVAILABILITY.emptyState.title}
            </h2>
          </div>
          <p className="text-muted max-w-xl leading-7 text-sm pr-11">
            {AVAILABILITY.emptyState.body}
          </p>
          <div className="pr-11">
            <Link href="#weekly-availability">
              <Button variant="secondary" size="sm">
                {AVAILABILITY.emptyState.cta}
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Weekly availability form */}
      <div id="weekly-availability">
        <WeeklyAvailabilityForm
          initialRules={rules.map((r) => ({
            weekday: r.weekday,
            startMinutes: r.startMinutes,
            endMinutes: r.endMinutes,
          }))}
        />
      </div>

      {/* Exceptions section */}
      <AvailabilityExceptions exceptions={exceptions} />
    </PremiumPageShell>
  );
}
