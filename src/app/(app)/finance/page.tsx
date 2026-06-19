import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireCurrentBusiness } from "@/server/auth/session";
import { getFinanceData, type PeriodFilter } from "@/server/finance/queries";
import { getRevenueForecastData } from "@/server/revenue-forecast/queries";
import { FinancePageClient } from "@/components/finance/finance-page-client";
import { FINANCE } from "@/lib/constants/he";

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
    <div className="w-full space-y-6">
      <PageHeader
        icon={Wallet}
        title={FINANCE.pageTitle}
        subtitle={FINANCE.pageSubtitle}
      />

      <FinancePageClient data={data} period={period} forecast={forecast} />
    </div>
  );
}
