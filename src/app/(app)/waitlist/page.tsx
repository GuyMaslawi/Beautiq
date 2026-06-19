import { Clock } from "lucide-react";
import { requireTenant } from "@/server/auth/session";
import { getWaitlistEntries } from "@/server/waitlist/queries";
import { getServices } from "@/server/services/queries";
import { PageHeader } from "@/components/ui/page-header";
import { WaitlistAddForm } from "@/components/waitlist/waitlist-add-form";
import { WaitlistList } from "@/components/waitlist/waitlist-list";
import { WAITLIST } from "@/lib/constants/he";

export default async function WaitlistPage() {
  const tenant = await requireTenant();

  const [entries, services] = await Promise.all([
    getWaitlistEntries(tenant),
    getServices(tenant),
  ]);

  const activeServices = services
    .filter((s) => s.isActive)
    .map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader icon={Clock} title={WAITLIST.title} subtitle={WAITLIST.subtitle} />
      <WaitlistAddForm services={activeServices} />
      <WaitlistList entries={entries} />
    </div>
  );
}
