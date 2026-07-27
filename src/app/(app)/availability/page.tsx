import { Clock } from "lucide-react";
import { PremiumPageShell, BeautyPageHero } from "@/components/premium";
import { requireTenant } from "@/server/auth/session";
import { getWeeklyRules, getAvailabilityExceptions } from "@/server/availability/queries";
import { WeeklyAvailabilityForm } from "@/components/availability/weekly-availability-form";
import { AvailabilityExceptions } from "@/components/availability/availability-exceptions";
import { AVAILABILITY } from "@/lib/constants/he";
import type { ExceptionRecord } from "@/components/availability/availability-exceptions";

export default async function AvailabilityPage() {
  const tenant = await requireTenant();

  const [rules, rawExceptions] = await Promise.all([
    getWeeklyRules(tenant),
    getAvailabilityExceptions(tenant),
  ]);

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

      {/* Weekly availability form — its own header now carries the guidance that
          used to live in a separate card above it. */}
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
