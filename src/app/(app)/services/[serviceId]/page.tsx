import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireTenant } from "@/server/auth/session";
import { getService } from "@/server/services/queries";
import { updateServiceAction } from "@/server/services/actions";
import { ServiceForm } from "@/components/services/service-form";
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

  const boundAction = updateServiceAction.bind(null, service.id);

  const initialValues = {
    name: service.name,
    description: service.description ?? undefined,
    durationMinutes: service.durationMinutes,
    price: service.price.toString(),
    bufferBeforeMinutes: service.bufferBeforeMinutes,
    bufferAfterMinutes: service.bufferAfterMinutes,
    categoryKey: service.categoryKey ?? undefined,
    isActive: service.isActive,
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {/* Breadcrumb header */}
      <div>
        <div className="mb-3 flex items-center gap-1.5 text-sm" style={{ color: "var(--muted)" }}>
          <Link
            href="/services"
            className="transition-colors hover:underline"
            style={{ color: "var(--muted)" }}
          >
            שירותים
          </Link>
          <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
          <span style={{ color: "var(--foreground-soft)" }}>עריכת שירות</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          {SERVICES.form.editTitle}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          {service.name} — עדכוני פרטים, מחיר וזמינות השירות
        </p>
      </div>

      <ServiceForm
        action={boundAction}
        initialValues={initialValues}
        isEdit
      />
    </div>
  );
}
