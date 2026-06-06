import { getPublicBusiness } from "@/server/public-booking/queries";
import { BookingRequestForm } from "./booking-request-form";
import { PUBLIC_BOOKING } from "@/lib/constants/he";

export default async function PublicBusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);

  if (!business) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            {PUBLIC_BOOKING.notFound}
          </h1>
        </div>
      </main>
    );
  }

  const location = [business.city, business.area].filter(Boolean).join(", ");

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-lg px-4 pb-12 pt-8 space-y-6">
        {/* Business header */}
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            {business.name}
          </h1>
          {business.description && (
            <p className="text-sm text-[var(--muted)]">{business.description}</p>
          )}
          {location && (
            <p className="text-sm text-[var(--muted)]">{location}</p>
          )}
          <p className="pt-1 text-sm text-[var(--muted)]">
            {PUBLIC_BOOKING.page.howItWorks}
          </p>
        </div>

        {/* Booking request form */}
        <BookingRequestForm slug={slug} services={business.services} />
      </div>
    </main>
  );
}
