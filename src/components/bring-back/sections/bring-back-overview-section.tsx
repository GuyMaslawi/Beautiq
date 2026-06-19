import Link from "next/link";
import { requireCurrentBusiness } from "@/server/auth/session";
import {
  getBringBackClients,
  computeBringBackSummary,
  DEFAULT_RETURN_WINDOW_DAYS,
  MIN_RETURN_WINDOW_DAYS,
  MAX_RETURN_WINDOW_DAYS,
} from "@/server/bring-back/queries";
import { BringBackHub } from "@/components/bring-back/bring-back-hub";
import { PageHeader } from "@/components/ui/page-header";
import { RefreshCcw, Settings } from "lucide-react";

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

  const serialisedClients = clients.map((c) => ({
    ...c,
    lastVisitAtISO: c.lastVisitAt.toISOString(),
    lastVisitAt: undefined,
  }));

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          icon={RefreshCcw}
          title="החזרת לקוחות"
          subtitle="לקוחות שלא קבעו תור זמן רב — שלחי להן הודעה אישית."
        />
        <Link
          href="/automations"
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-opacity hover:opacity-70 shrink-0 mt-1"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--muted)",
          }}
        >
          <Settings className="h-3.5 w-3.5" />
          הגדרות אוטומציה
        </Link>
      </div>

      <BringBackHub
        clients={serialisedClients}
        summary={summary}
        thresholdDays={thresholdDays}
        businessName={business.name}
      />
    </div>
  );
}
