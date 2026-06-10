import Link from "next/link";
import { Clock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
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
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* Page header */}
      <PageHeader
        icon={Clock}
        title={AVAILABILITY.pageTitle}
        subtitle={AVAILABILITY.pageSubtitle}
      />

      {/* Empty state guidance — shown only when no rules are configured yet */}
      {!hasRules && (
        <div
          className="rounded-2xl border p-5 space-y-3"
          style={{
            borderColor: "rgba(184,107,140,0.2)",
            background: "rgba(184,107,140,0.05)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "rgba(184,107,140,0.12)" }}
            >
              <Clock className="h-4 w-4" style={{ color: "#b86b8c" }} />
            </div>
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
    </div>
  );
}
