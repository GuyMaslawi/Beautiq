import { Zap, ChevronDown, MessageSquare, AlertCircle, Info } from "lucide-react";
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
import { getAutomationMessageLog } from "@/server/automations/message-queries";
import { getLastAutomationRun } from "@/server/automations/run-queries";
import { getOwnerWhatsAppStatus } from "@/server/whatsapp/owner-status";
import { isRealSendConfigured, isTestModeActive } from "@/lib/whatsapp/provider";
import { WhatsAppConnectionCard } from "@/components/whatsapp/whatsapp-connection-card";
import { PageHeader } from "@/components/ui/page-header";
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

  return (
    <div className="w-full space-y-6">
      <PageHeader
        icon={Zap}
        title="אוטומציות"
        subtitle="הודעות שנשלחות אוטומטית כדי לחסוך זמן ולשמור על קשר עם הלקוחות."
      />

      {/* Owner WhatsApp connection (Embedded Signup) + template setup */}
      <WhatsAppConnectionCard
        status={ownerWhatsAppStatus}
        appId={process.env.NEXT_PUBLIC_META_APP_ID}
        configId={process.env.NEXT_PUBLIC_META_CONFIG_ID}
        graphVersion={process.env.NEXT_PUBLIC_META_GRAPH_VERSION ?? "v19.0"}
        isAdmin={user?.isAdmin ?? false}
      />

      {/* WhatsApp status banners — never show technical credentials */}

      {/* Dev mode: real send not enabled */}
      {!realSendConfigured && (
        <div
          className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
          dir="rtl"
          style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.28)" }}
        >
          <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#b45309" }} />
          <p className="text-sm leading-relaxed" style={{ color: "#92400e" }}>
            <strong>מצב בדיקה</strong> — הודעות לא נשלחות ללקוחות אמיתיים.
            ניתן להגדיר את האוטומציות, אך שליחה בפועל תופעל רק כאשר WhatsApp Business יהיה מחובר.
          </p>
        </div>
      )}

      {/* Env fallback: connection defined at system level, not per business */}
      {realSendConfigured && isEnvFallback && (
        <div
          className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
          dir="rtl"
          style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.28)" }}
        >
          <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#b45309" }} />
          <p className="text-sm leading-relaxed" style={{ color: "#92400e" }}>
            <strong>מצב בדיקה — החיבור מוגדר ברמת המערכת ולא ברמת העסק.</strong>{" "}
            הודעות לא מייצגות חיבור אמיתי של העסק.
          </p>
        </div>
      )}

      {/* Test mode active */}
      {realSendConfigured && testMode && (
        <div
          className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
          dir="rtl"
          style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.28)" }}
        >
          <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#b45309" }} />
          <p className="text-sm leading-relaxed" style={{ color: "#92400e" }}>
            <strong>מצב בדיקה פעיל</strong> — הודעות נשלחות רק למספר הבדיקה המוגדר.
            לקוחות אמיתיים לא יקבלו הודעות עד שמצב הבדיקה יכובה.
          </p>
        </div>
      )}

      {/* Connection failed — red only after an actual attempt failed (never as a first impression) */}
      {realSendConfigured && !testMode && !isEnvFallback && ownerConnectionState === "error" && (
        <div
          className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
          dir="rtl"
          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.20)" }}
        >
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#dc2626" }} />
          <p className="text-sm leading-relaxed" style={{ color: "#991b1b" }}>
            <strong>לא הצלחנו לחבר את WhatsApp</strong> — נסי שוב, ואם הבעיה נמשכת פני לתמיכה.
          </p>
        </div>
      )}

      {/* Properly connected — production mode */}
      {realSendConfigured && !testMode && whatsappConnected && !isEnvFallback && (
        <div
          className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
          dir="rtl"
          style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.20)" }}
        >
          <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#15803d" }} />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold" style={{ color: "#14532d" }}>
              WhatsApp מחובר
            </p>
            <p className="text-xs" style={{ color: "#15803d" }}>
              מצב בדיקה כבוי · חיבור ברמת העסק · האוטומציות פעילות
            </p>
          </div>
        </div>
      )}

      {/* Automation cards — each shows status, settings, and last run summary */}
      <div className="grid grid-cols-2 gap-3">
        <WinBackAutomationCard
          setting={setting}
          lastRun={winBackLastRunSummary}
          realSendConfigured={realSendConfigured}
          testMode={testMode}
          locked={automationsLocked}
        />

        <MorningReminderCard
          setting={morningReminderSetting}
          sentThisMonth={morningReminderStats.sentThisMonth}
          lastRun={morningReminderLastRunSummary}
          realSendConfigured={realSendConfigured}
          testMode={testMode}
          locked={automationsLocked}
        />

        <ReviewRequestCard
          setting={reviewRequestSetting}
          sentThisMonth={reviewRequestStats.sentThisMonth}
          lastRun={reviewRequestLastRunSummary}
          realSendConfigured={realSendConfigured}
          testMode={testMode}
          locked={automationsLocked}
        />

        <BookingConfirmationCard
          setting={bookingConfirmationSetting}
          lastRun={bookingConfirmationLastRunSummary}
          realSendConfigured={realSendConfigured}
          testMode={testMode}
          isAdmin={user?.isAdmin ?? false}
          locked={automationsLocked}
        />

        {/* ManualRunCard (eligibility checker) — admin-only */}
        {user?.isAdmin && <ManualRunCard isAdmin />}

        {user?.isAdmin && <AdminCronTestCard businessId={business.id} />}
      </div>

      {/* Message log */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5" dir="rtl">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0"
            style={{ background: "rgba(184,107,140,0.10)" }}
          >
            <MessageSquare className="h-4 w-4" style={{ color: "#b86b8c" }} />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
              יומן הודעות
            </h2>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              הודעות אוטומטיות שנשלחו — ניתן לנסות שוב הודעות שנכשלו.
            </p>
          </div>
        </div>
        <AutomationMessageLog messages={messageLog} />
      </div>

      {/* Admin section — hidden from regular users */}
      {user?.isAdmin && (
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
            בדיקות טכניות
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
    </div>
  );
}
