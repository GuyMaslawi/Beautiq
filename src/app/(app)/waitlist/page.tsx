import { Clock, UserCheck } from "lucide-react";
import { requireTenant } from "@/server/auth/session";
import { getWaitlistEntries } from "@/server/waitlist/queries";
import { getServices } from "@/server/services/queries";
import { WaitlistAddForm } from "@/components/waitlist/waitlist-add-form";
import { WaitlistList } from "@/components/waitlist/waitlist-list";
import { WAITLIST } from "@/lib/constants/he";
import { PremiumPageShell } from "@/components/premium/page-shell";
import { BeautyPageHero } from "@/components/premium/page-hero";

export default async function WaitlistPage() {
  const tenant = await requireTenant();

  const [entries, services] = await Promise.all([
    getWaitlistEntries(tenant),
    getServices(tenant),
  ]);

  const activeServices = services
    .filter((s) => s.isActive)
    .map((s) => ({ id: s.id, name: s.name }));

  const waitingCount = entries.filter(
    (e) => e.status === "active" || e.status === "notified",
  ).length;

  return (
    <PremiumPageShell tint="blush" width="narrow">
      <BeautyPageHero
        icon={Clock}
        eyebrow="ביקוש שממתין לך"
        title={WAITLIST.title}
        subtitle={WAITLIST.subtitle}
        tint="blush"
        stats={
          waitingCount > 0
            ? [{ label: "ממתינות עכשיו", value: waitingCount, icon: <UserCheck className="h-4 w-4" />, tone: "brand" }]
            : undefined
        }
      />
      <WaitlistAddForm services={activeServices} />
      <WaitlistList entries={entries} />
    </PremiumPageShell>
  );
}
