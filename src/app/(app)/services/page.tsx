import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireTenant } from "@/server/auth/session";
import { getServices } from "@/server/services/queries";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ServiceCard } from "@/components/services/service-card";
import { SERVICES } from "@/lib/constants/he";

export default async function ServicesPage() {
  const tenant = await requireTenant();
  const services = await getServices(tenant);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "rgba(184,107,140,0.10)" }}
            >
              <Sparkles className="h-4 w-4" style={{ color: "#b86b8c" }} />
            </div>
            <h1 className="text-foreground text-2xl font-bold tracking-tight">
              {SERVICES.pageTitle}
            </h1>
          </div>
          <p className="text-muted text-sm leading-6">
            {SERVICES.pageSubtitle}
          </p>
        </div>
        <Link href="/services/new">
          <Button size="sm">{SERVICES.addButton}</Button>
        </Link>
      </div>

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
