import Link from "next/link";
import { requireTenant } from "@/server/auth/session";
import { getServices } from "@/server/services/queries";
import { getClientBasic } from "@/server/clients/queries";
import { createBookingAction } from "@/server/bookings/actions";
import { BookingForm } from "@/components/bookings/booking-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BOOKINGS } from "@/lib/constants/he";

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const tenant = await requireTenant();
  const { clientId } = await searchParams;

  const [allServices, prefillClient] = await Promise.all([
    getServices(tenant),
    clientId ? getClientBasic(tenant, clientId) : Promise.resolve(null),
  ]);

  const activeServices = allServices.filter((s) => s.isActive);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link href="/bookings" className="shrink-0">
          <Button variant="ghost" size="sm">
            → {BOOKINGS.form.backLink}
          </Button>
        </Link>
        <h1 className="text-foreground text-xl font-bold tracking-tight">
          {BOOKINGS.form.createTitle}
        </h1>
      </div>

      <Card>
        <BookingForm
          action={createBookingAction}
          services={activeServices.map((s) => ({
            id: s.id,
            name: s.name,
            durationMinutes: s.durationMinutes,
            price: s.price.toString(),
          }))}
          initialClientName={prefillClient?.fullName}
          initialClientPhone={prefillClient?.phone}
        />
      </Card>
    </div>
  );
}
