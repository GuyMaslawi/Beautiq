import { Zap, ChevronDown } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentBusiness, getCurrentUser } from "@/server/auth/session";
import {
  getWinBackAutomationSetting,
  getWhatsAppConnection,
  getWinBackStatsThisMonth,
  getLastWinBackRun,
} from "@/server/win-back-automation/queries";
import { PageHeader } from "@/components/ui/page-header";
import { WinBackAutomationCard } from "@/components/automations/win-back-automation-card";
import { ComingSoonCard } from "@/components/automations/coming-soon-card";

export default async function AutomationsPage() {
  const [business, user] = await Promise.all([getCurrentBusiness(), getCurrentUser()]);
  if (!business) redirect("/dashboard");

  const tenant = { businessId: business.id };

  const [setting, connection, stats, lastRun] = await Promise.all([
    getWinBackAutomationSetting(tenant),
    getWhatsAppConnection(tenant),
    getWinBackStatsThisMonth(tenant),
    getLastWinBackRun(tenant),
  ]);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        icon={Zap}
        title="אוטומציות"
        subtitle="הודעות שנשלחות אוטומטית כדי לחסוך זמן ולשמור על קשר עם הלקוחות."
      />

      <div className="grid grid-cols-2 gap-3">
        <WinBackAutomationCard setting={setting} />

        <ComingSoonCard
          title="תזכורות לתורים"
          description="תזכורת תישלח לפני התור כדי להפחית איחורים וביטולים."
        />

        <ComingSoonCard
          title="תודה אחרי ביקור"
          description="הודעת תודה תישלח לאחר הטיפול."
        />

        <ComingSoonCard
          title="בקשת ביקורת"
          description="בקשה לדירוג תישלח לאחר הביקור."
        />
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
              <span><strong>Automation:</strong> {setting?.enabled ? "enabled" : "disabled"}</span>
              <span><strong>Template:</strong> {setting?.templateName ?? "—"}</span>
            </div>
            <div className="flex gap-4 flex-wrap">
              <span><strong>Last run:</strong> {lastRun?.startedAt?.toISOString() ?? "never"}</span>
              <span><strong>Last webhook:</strong> {connection?.lastWebhookReceivedAt?.toISOString() ?? "never"}</span>
              <span><strong>Sent/month:</strong> {stats.realSentThisMonth}</span>
              <span><strong>Failed/month:</strong> {stats.failedThisMonth}</span>
              <span><strong>Mock/month:</strong> {stats.mockRunsThisMonth}</span>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
