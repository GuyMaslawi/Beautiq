import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireTenant } from "@/server/auth/session";
import { getServices } from "@/server/services/queries";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ServiceCard } from "@/components/services/service-card";
import { PageHeader } from "@/components/ui/page-header";
import { SERVICES } from "@/lib/constants/he";

export default async function ServicesPage() {
  const tenant = await requireTenant();
  const services = await getServices(tenant);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Page header */}
      <PageHeader
        icon={Sparkles}
        title={SERVICES.pageTitle}
        subtitle="כאן מגדירים את השירותים שהעסק מציע, משך הטיפול, מחיר ומקדמה."
        action={
          <Link href="/services/new">
            <Button size="sm">{SERVICES.addButton}</Button>
          </Link>
        }
      />

      {/* Empty state */}
      {services.length === 0 && (
        <EmptyState
          title={SERVICES.emptyState.title}
          body={SERVICES.emptyState.body}
          cta={SERVICES.emptyState.cta}
          ctaHref="/services/new"
          icon={<Sparkles className="h-7 w-7" style={{ color: "#b86b8c" }} />}
        />
      )}

      {/* Service list */}
      {services.length > 0 && (
        <div className="space-y-4">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </div>
  );
}
