import { requireCurrentBusiness } from "@/server/auth/session";
import { RefreshCcw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  getBringBackClients,
  computeBringBackSummary,
  DEFAULT_RETURN_WINDOW_DAYS,
  MIN_RETURN_WINDOW_DAYS,
  MAX_RETURN_WINDOW_DAYS,
} from "@/server/bring-back/queries";
import { getWinBackAutomationData } from "@/server/win-back-automation/queries";
import { BringBackHub } from "@/components/bring-back/bring-back-hub";
import { WinBackStatusPanel } from "@/components/win-back-automation/win-back-status-panel";
import { WinBackSettingsForm } from "@/components/win-back-automation/win-back-settings-form";
import { BRING_BACK } from "@/lib/constants/he";
import { isRealSendConfigured } from "@/lib/whatsapp/provider";

export default async function BringBackPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const [business, params] = await Promise.all([
    requireCurrentBusiness(),
    searchParams,
  ]);

  const rawDays = Number(params.days);
  const thresholdDays =
    rawDays >= MIN_RETURN_WINDOW_DAYS && rawDays <= MAX_RETURN_WINDOW_DAYS
      ? rawDays
      : DEFAULT_RETURN_WINDOW_DAYS;

  const tenant = { businessId: business.id };
  const [clients, automationData] = await Promise.all([
    getBringBackClients(tenant, thresholdDays),
    getWinBackAutomationData(tenant),
  ]);
  const summary = computeBringBackSummary(clients);

  // Serialise Date → ISO string before passing to client component
  const serialisedClients = clients.map((c) => ({
    ...c,
    lastVisitAtISO: c.lastVisitAt.toISOString(),
    lastVisitAt: undefined,
  }));

  return (
    <div className="w-full space-y-8">
      <PageHeader
        icon={RefreshCcw}
        title={BRING_BACK.pageTitle}
        subtitle={BRING_BACK.pageSubtitle}
      />

      {/* ── Automation section ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Status panel — right side (wider) */}
        <div className="lg:col-span-3">
          <WinBackStatusPanel
            setting={automationData.setting}
            connection={automationData.connection}
            lastRun={automationData.lastRun}
            stats={automationData.stats}
            eligibleCount={automationData.eligibleCount}
            breakdown={automationData.breakdown}
            realSendEnabled={automationData.realSendEnabled}
            credentialsConfigured={automationData.credentialsConfigured}
            testModeActive={automationData.testModeActive}
            testPhoneConfigured={automationData.testPhoneConfigured}
            sandboxTestPassed={automationData.sandboxTestPassed}
            hasRealBusinessPhone={automationData.hasRealBusinessPhone}
          />
        </div>

        {/* Settings form — left side (narrower) */}
        <div className="lg:col-span-2">
          <div
            className="rounded-2xl p-5"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <WinBackSettingsForm
              setting={automationData.setting}
              setupStatus={{
                providerConfigured: process.env.WHATSAPP_PROVIDER === "meta_cloud_api",
                credentialsConfigured: isRealSendConfigured(),
                testPhoneConfigured: automationData.testPhoneConfigured,
                templateConfigured: !!automationData.setting?.templateName,
                testModeActive: automationData.testModeActive,
                realSendEnabled: automationData.realSendEnabled,
                sandboxTestPassed: automationData.sandboxTestPassed,
                hasRealBusinessPhone: automationData.hasRealBusinessPhone,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Manual send section ─────────────────────────────────────────────── */}
      <BringBackHub
        clients={serialisedClients}
        summary={summary}
        thresholdDays={thresholdDays}
        businessName={business.name}
      />
    </div>
  );
}
