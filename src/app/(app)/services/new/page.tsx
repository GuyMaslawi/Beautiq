import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireTenant } from "@/server/auth/session";
import { createServiceAction } from "@/server/services/actions";
import { ServiceForm } from "@/components/services/service-form";
import { SERVICES } from "@/lib/constants/he";

export default async function NewServicePage() {
  await requireTenant();

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
          <span style={{ color: "var(--foreground-soft)" }}>הוספת שירות</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          {SERVICES.form.createTitle}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          הגדירי שם, מחיר, זמן טיפול ואפשרויות מקדמה
        </p>
      </div>

      <ServiceForm action={createServiceAction} />
    </div>
  );
}
