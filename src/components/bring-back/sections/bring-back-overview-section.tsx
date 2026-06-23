import { requireCurrentBusiness } from "@/server/auth/session";
import {
  getBringBackClients,
  computeBringBackSummary,
  DEFAULT_RETURN_WINDOW_DAYS,
  MIN_RETURN_WINDOW_DAYS,
  MAX_RETURN_WINDOW_DAYS,
} from "@/server/bring-back/queries";
import { BringBackHub } from "@/components/bring-back/bring-back-hub";
import { BeautyPageHero } from "@/components/premium/page-hero";
import { RefreshCcw, Users2, Banknote } from "lucide-react";

/**
 * סקירת "לקוחות שלא חזרו" — תוכן הליבה של /bring-back.
 * חולץ למרכיב משותף כדי שישמש גם את כרטיסיית הסקירה במרכז וגם את הנתיב המקורי.
 */
export async function BringBackOverviewSection({ days }: { days?: string }) {
  const business = await requireCurrentBusiness();

  const rawDays = Number(days);
  const thresholdDays =
    rawDays >= MIN_RETURN_WINDOW_DAYS && rawDays <= MAX_RETURN_WINDOW_DAYS
      ? rawDays
      : DEFAULT_RETURN_WINDOW_DAYS;

  const tenant = { businessId: business.id };
  const clients = await getBringBackClients(tenant, thresholdDays);
  const summary = computeBringBackSummary(clients);

  // "כסף להחזרה" — the historical value of the lapsed clients, a tangible
  // proxy for what's at stake if they don't come back. Display only.
  const recoverableValue = clients.reduce((sum, c) => sum + c.totalRevenue, 0);

  const serialisedClients = clients.map((c) => ({
    ...c,
    lastVisitAtISO: c.lastVisitAt.toISOString(),
    lastVisitAt: undefined,
  }));

  return (
    <div className="w-full space-y-6">
      <BeautyPageHero
        icon={RefreshCcw}
        eyebrow="מרכז צמיחה"
        title="החזרת לקוחות"
        subtitle="מי כדאי להחזיר עכשיו כדי להחזיר כסף לעסק? אלו הלקוחות שלא קבעו תור זמן רב — שלחי להן הודעה אישית."
        tint="plum"
        stats={[
          { label: "לקוחות לפנייה", value: summary.total, icon: <Users2 className="h-4 w-4" />, tone: "brand" },
          {
            label: "כסף להחזרה",
            value: `₪${Math.round(recoverableValue).toLocaleString("he-IL")}`,
            icon: <Banknote className="h-4 w-4" />,
            tone: "success",
          },
        ]}
      />

      <BringBackHub
        clients={serialisedClients}
        summary={summary}
        thresholdDays={thresholdDays}
        businessName={business.name}
      />
    </div>
  );
}
