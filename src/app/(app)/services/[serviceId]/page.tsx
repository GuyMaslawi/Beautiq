import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/server/auth/session";
import { getService } from "@/server/services/queries";
import { updateServiceAction } from "@/server/services/actions";
import { ServiceForm } from "@/components/services/service-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SERVICES } from "@/lib/constants/he";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const tenant = await requireTenant();
  const { serviceId } = await params;

  const service = await getService(tenant, serviceId);
  if (!service) notFound();

  // Bind the serviceId so the client form receives a (prevState, formData) action.
  const boundAction = updateServiceAction.bind(null, service.id);

  const initialValues = {
    name: service.name,
    description: service.description ?? undefined,
    durationMinutes: service.durationMinutes,
    price: service.price.toString(),
    requiresDeposit: service.requiresDeposit,
    depositAmount: service.depositAmount?.toString() ?? undefined,
    bufferBeforeMinutes: service.bufferBeforeMinutes,
    bufferAfterMinutes: service.bufferAfterMinutes,
    categoryKey: service.categoryKey ?? undefined,
    isActive: service.isActive,
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link href="/services" className="shrink-0">
          <Button variant="ghost" size="sm">
            → חזרה
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-foreground text-xl font-bold tracking-tight">
            {SERVICES.form.editTitle}
          </h1>
          <p className="text-muted mt-0.5 text-sm">{service.name}</p>
        </div>
      </div>

      <Card>
        <ServiceForm
          action={boundAction}
          initialValues={initialValues}
          isEdit
        />
      </Card>
    </div>
  );
}
