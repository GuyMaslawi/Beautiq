import Link from "next/link";
import { requireTenant } from "@/server/auth/session";
import { createServiceAction } from "@/server/services/actions";
import { ServiceForm } from "@/components/services/service-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SERVICES } from "@/lib/constants/he";

export default async function NewServicePage() {
  // Ensures user is authenticated and has a business; redirects otherwise.
  await requireTenant();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link href="/services" className="shrink-0">
          <Button variant="ghost" size="sm">
            → חזרה
          </Button>
        </Link>
        <h1 className="text-foreground text-xl font-bold tracking-tight">
          {SERVICES.form.createTitle}
        </h1>
      </div>

      <Card>
        <ServiceForm action={createServiceAction} />
      </Card>
    </div>
  );
}
