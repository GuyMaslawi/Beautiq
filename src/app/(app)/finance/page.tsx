import { Wallet } from "lucide-react";
import { requireCurrentBusiness } from "@/server/auth/session";
import { getFinanceData, type PeriodFilter } from "@/server/finance/queries";
import { getRevenueForecastData } from "@/server/revenue-forecast/queries";
import { FinancePageClient } from "@/components/finance/finance-page-client";
import { FINANCE } from "@/lib/constants/he";
import { PremiumPageShell } from "@/components/premium/page-shell";
import { BeautyPageHero } from "@/components/premium/page-hero";

const VALID_PERIODS: PeriodFilter[] = ["today", "week", "month", "year"];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FinancePage({ searchParams }: PageProps) {
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };

  const params = await searchParams;
  const rawPeriod = typeof params.period === "string" ? params.period : "month";
  const period: PeriodFilter = VALID_PERIODS.includes(rawPeriod as PeriodFilter)
    ? (rawPeriod as PeriodFilter)
    : "month";

  const [data, forecast] = await Promise.all([
    getFinanceData(tenant, period),
    getRevenueForecastData(tenant),
  ]);

  return (
    <PremiumPageShell tint="champagne" width="wide">
      <BeautyPageHero
        icon={Wallet}
        eyebrow="התמונה הכספית"
        title={FINANCE.pageTitle}
        subtitle={FINANCE.pageSubtitle}
        tint="champagne"
      />

      <FinancePageClient data={data} period={period} forecast={forecast} />
    </PremiumPageShell>
  );
}
