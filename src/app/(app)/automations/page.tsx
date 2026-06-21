import { Zap, ChevronDown, MessageSquare } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentBusiness, getCurrentUser } from "@/server/auth/session";
import {
  getWinBackAutomationSetting,
  getWhatsAppConnection,
  getWinBackStatsThisMonth,
  getLastWinBackRun,
} from "@/server/win-back-automation/queries";
import { getMorningReminderSetting, getMorningReminderStatsThisMonth, getLastMorningReminderRun } from "@/server/morning-reminder/queries";
import { getReviewRequestSetting, getReviewRequestStatsThisMonth, getLastReviewRequestRun } from "@/server/review-request/queries";
import { getBookingConfirmationSetting } from "@/server/booking-confirmation/queries";
import { getAutomationMessageLog, getWhatsAppActivityStats } from "@/server/automations/message-queries";
import { getLastAutomationRun } from "@/server/automations/run-queries";
import { getOwnerWhatsAppStatus } from "@/server/whatsapp/owner-status";
import { getReviewDemoStatus } from "@/server/whatsapp/review-demo";
import { getDiagnosticClientOptions } from "@/server/whatsapp/diagnostics";
import { WhatsAppDiagnosticsPanel } from "@/components/whatsapp/whatsapp-diagnostics-panel";
import { isRealSendConfigured, isTestModeActive } from "@/lib/whatsapp/provider";
import { isMinuteTestingAllowed } from "@/lib/automation/minute-testing";
import { WhatsAppConnectionCard } from "@/components/whatsapp/whatsapp-connection-card";
import { WhatsAppStatusBanners } from "@/components/whatsapp/whatsapp-status-banners";
import { ReviewDemoCard } from "@/components/whatsapp/review-demo-card";
import { PremiumPageShell } from "@/components/premium/page-shell";
import { BeautyPageHero } from "@/components/premium/page-hero";
import { EditorialSectionHeader } from "@/components/premium/section-header";
import { WinBackAutomationCard } from "@/components/automations/win-back-automation-card";
import { MorningReminderCard } from "@/components/automations/morning-reminder-card";
import { ReviewRequestCard } from "@/components/automations/review-request-card";
import { AutomationMessageLog } from "@/components/automations/automation-message-log";
import { ManualRunCard } from "@/components/automations/manual-run-card";
import { AdminCronTestCard } from "@/components/automations/admin-cron-test-card";
import { BookingConfirmationCard } from "@/components/automations/booking-confirmation-card";

export default async function AutomationsPage() {
  const [business, user] = await Promise.all([getCurrentBusiness(), getCurrentUser()]);
  if (!business) redirect("/dashboard");

  const tenant = { businessId: business.id };

  const [
    setting,
    connection,
    stats,
    lastWinBackRun,
    morningReminderSetting,
    morningReminderStats,
    reviewRequestSetting,
    reviewRequestStats,
    bookingConfirmationSetting,
    messageLog,
    lastMorningReminderRun,
    lastReviewRequestRun,
  ] = await Promise.all([
    getWinBackAutomationSetting(tenant),
    getWhatsAppConnection(tenant),
    getWinBackStatsThisMonth(tenant),
    getLastWinBackRun(tenant),
    getMorningReminderSetting(tenant),
    getMorningReminderStatsThisMonth(tenant),
    getReviewRequestSetting(tenant),
    getReviewRequestStatsThisMonth(tenant),
    getBookingConfirmationSetting(tenant),
    getAutomationMessageLog(tenant, { limit: 50 }),
    getLastMorningReminderRun(tenant),
    getLastReviewRequestRun(tenant),
  ]);

  // Owner-facing WhatsApp connection + per-automation template readiness.
  const ownerWhatsAppStatus = await getOwnerWhatsAppStatus(business.id);

  // Compact operational stats shown once WhatsApp is connected (State B).
  const whatsappActivity = await getWhatsAppActivityStats(tenant);

  // Meta App Review demo status — admin/reviewer-only, business-scoped.
  const reviewDemoStatus = user?.isAdmin
    ? await getReviewDemoStatus(business.id)
    : null;

  // WhatsApp diagnostics client picker — admin-only, business-scoped.
  const diagnosticClients = user?.isAdmin
    ? await getDiagnosticClientOptions(business.id)
    : [];

  // Fetch last run summaries (with skipped-reason breakdowns) for all 4 automation types
  const [winBackLastRunSummary, morningReminderLastRunSummary, reviewRequestLastRunSummary, bookingConfirmationLastRunSummary] =
    await Promise.all([
      getLastAutomationRun(tenant, "win_back"),
      getLastAutomationRun(tenant, "morning_reminder"),
      getLastAutomationRun(tenant, "review_request"),
      getLastAutomationRun(tenant, "booking_confirmation"),
    ]);

  // WhatsApp readiness banners — shown above the cards
  const realSendConfigured = isRealSendConfigured();
  const testMode = isTestModeActive();
  // Owner-facing connection state — drives the calm onboarding vs. connected UX.
  const ownerConnectionState = ownerWhatsAppStatus.connection.state; // not_connected | pending | active | error
  const whatsappConnected = ownerConnectionState === "active";
  // isEnvFallback: true only when a business has NO per-business connection but the system env fallback is active.
  // A business with an active WhatsAppConnection is always treated as production-connected.
  const isEnvFallback =
    !whatsappConnected &&
    process.env.WHATSAPP_USE_ENV_FALLBACK === "true" &&
    realSendConfigured;

  // Automations are "locked" (shown but disabled) until the business connects WhatsApp.
  // Dev mode, test mode, and the system-level env fallback are not real owner connections,
  // but they all allow sending, so the cards stay usable in those cases.
  const automationsLocked =
    realSendConfigured && !testMode && !isEnvFallback && !whatsappConnected;

  // Minute-based test timing is admin/dev-only — hidden from regular owners by default.
  const isAdmin = user?.isAdmin === true;
  const allowMinuteTesting = isMinuteTestingAllowed({ isAdmin });

  return (
    <PremiumPageShell tint="sage" width="wide">
      <BeautyPageHero
        icon={Zap}
        eyebrow="על טייס אוטומטי"
        title="אוטומציות"
        subtitle="הודעות שנשלחות אוטומטית כדי לחסוך זמן ולשמור על קשר עם הלקוחות."
        tint="sage"
      />

      {/* Owner WhatsApp connection (Embedded Signup) + template setup */}
      <WhatsAppConnectionCard
        status={ownerWhatsAppStatus}
        activity={whatsappActivity}
        appId={process.env.NEXT_PUBLIC_META_APP_ID}
        configId={process.env.NEXT_PUBLIC_META_CONFIG_ID}
        graphVersion={process.env.NEXT_PUBLIC_META_GRAPH_VERSION ?? "v19.0"}
        isAdmin={isAdmin}
        realSendEnabled={realSendConfigured}
        usingEnvFallback={isEnvFallback}
      />

      {/* Meta App Review demo panel — admin/reviewer-only */}
      {reviewDemoStatus && (
        <ReviewDemoCard status={reviewDemoStatus} businessId={business.id} />
      )}

      {/* WhatsApp status banners — test-mode/debug banners are admin-only;
          owners only ever see owner-safe connection state. */}
      <WhatsAppStatusBanners
        isAdmin={isAdmin}
        realSendConfigured={realSendConfigured}
        testMode={testMode}
        isEnvFallback={isEnvFallback}
        connectionState={ownerConnectionState}
        whatsappConnected={whatsappConnected}
      />

      {/* Automation cards — each shows status, settings, and last run summary */}
      <EditorialSectionHeader
        eyebrow="הזרימות שלך"
        title="האוטומציות שלך"
        description="כל זרימה שולחת הודעה בזמן הנכון — הפעילי, כבי או התאימי לכל אחת."
        icon={<Zap className="h-3.5 w-3.5" />}
        tint="sage"
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <WinBackAutomationCard
          setting={setting}
          lastRun={winBackLastRunSummary}
          realSendConfigured={realSendConfigured}
          testMode={testMode}
          isAdmin={isAdmin}
          locked={automationsLocked}
          allowMinuteTesting={allowMinuteTesting}
        />

        <MorningReminderCard
          setting={morningReminderSetting}
          sentThisMonth={morningReminderStats.sentThisMonth}
          lastRun={morningReminderLastRunSummary}
          realSendConfigured={realSendConfigured}
          testMode={testMode}
          isAdmin={isAdmin}
          locked={automationsLocked}
        />

        <ReviewRequestCard
          setting={reviewRequestSetting}
          sentThisMonth={reviewRequestStats.sentThisMonth}
          lastRun={reviewRequestLastRunSummary}
          realSendConfigured={realSendConfigured}
          testMode={testMode}
          isAdmin={isAdmin}
          locked={automationsLocked}
        />

        <BookingConfirmationCard
          setting={bookingConfirmationSetting}
          lastRun={bookingConfirmationLastRunSummary}
          realSendConfigured={realSendConfigured}
          testMode={testMode}
          isAdmin={isAdmin}
          locked={automationsLocked}
        />

        {/* ManualRunCard (eligibility checker) — admin-only */}
        {isAdmin && <ManualRunCard isAdmin />}

        {isAdmin && <AdminCronTestCard businessId={business.id} />}

        {/* WhatsApp send diagnostics (dry-run + controlled test send) — admin-only */}
        {isAdmin && <WhatsAppDiagnosticsPanel clients={diagnosticClients} />}
      </div>

      {/* Message log */}
      <div className="space-y-4">
        <EditorialSectionHeader
          eyebrow="פעילות"
          title="יומן הודעות"
          description="הודעות אוטומטיות שנשלחו — ניתן לנסות שוב הודעות שנכשלו."
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          tint="sage"
        />
        <AutomationMessageLog messages={messageLog} />
      </div>

      {/* Admin section — hidden from regular users */}
      {isAdmin && (
        <details className="group">
          <summary
            className="flex cursor-pointer list-none items-center gap-2 select-none rounded-xl px-4 py-2.5 text-xs font-medium"
            style={{
              background: "rgba(107,114,128,0.06)",
              border: "1px solid var(--border)",
              color: "var(--muted)",
            }}
          >
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            אזור בדיקות למנהל בלבד
            <span className="ms-auto rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
              Admin
            </span>
          </summary>

          <div
            className="mt-2 rounded-xl p-4 text-xs space-y-2"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--muted)",
              direction: "ltr",
            }}
          >
            <div className="flex gap-4 flex-wrap">
              <span><strong>Provider:</strong> {connection?.provider ?? "—"}</span>
              <span><strong>WA Status:</strong> {connection?.status ?? "not_connected"}</span>
              <span><strong>Phone:</strong> {connection?.phoneNumber ?? "—"}</span>
              <span><strong>Win-back:</strong> {setting?.enabled ? "enabled" : "disabled"}</span>
              <span><strong>Template:</strong> {setting?.templateName ?? "—"}</span>
            </div>
            <div className="flex gap-4 flex-wrap">
              <span><strong>Last win-back run:</strong> {lastWinBackRun?.startedAt?.toISOString() ?? "never"}</span>
              <span><strong>Last morning-reminder run:</strong> {lastMorningReminderRun?.startedAt?.toISOString() ?? "never"}</span>
              <span><strong>Last review-request run:</strong> {lastReviewRequestRun?.startedAt?.toISOString() ?? "never"}</span>
              <span><strong>Last webhook:</strong> {connection?.lastWebhookReceivedAt?.toISOString() ?? "never"}</span>
              <span><strong>Win-back sent/month:</strong> {stats.realSentThisMonth}</span>
              <span><strong>Morning reminder sent/month:</strong> {morningReminderStats.sentThisMonth}</span>
              <span><strong>Review requests sent/month:</strong> {reviewRequestStats.sentThisMonth}</span>
            </div>
          </div>
        </details>
      )}
    </PremiumPageShell>
  );
}
