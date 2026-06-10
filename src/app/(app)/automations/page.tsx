import { Zap, Info } from "lucide-react";
import { getCurrentBusiness } from "@/server/auth/session";
import { getRemindersData } from "@/server/automations/queries";
import {
  getWinBackAutomationSetting,
  getWhatsAppConnection,
  getWinBackStatsThisMonth,
} from "@/server/win-back-automation/queries";
import { PageHeader } from "@/components/ui/page-header";
import { ReminderSettingsForm } from "@/components/automations/reminder-settings-form";
import { RemindersDueList } from "@/components/automations/reminders-due-list";
import { WinBackAutomationsCard } from "@/components/win-back-automation/win-back-automations-card";
import { AUTOMATIONS } from "@/lib/constants/he";
import { redirect } from "next/navigation";

const c = AUTOMATIONS.reminders;

export default async function AutomationsPage() {
  const business = await getCurrentBusiness();
  if (!business) redirect("/dashboard");

  const tenant = { businessId: business.id };

  const [{ settings, remindersDue }, setting, connection, stats] =
    await Promise.all([
      getRemindersData(tenant),
      getWinBackAutomationSetting(tenant),
      getWhatsAppConnection(tenant),
      getWinBackStatsThisMonth(tenant),
    ]);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        icon={Zap}
        title={AUTOMATIONS.pageTitle}
        subtitle={AUTOMATIONS.pageSubtitle}
      />

      {/* ── Win-back automation card ──────────────────────────────────────── */}
      <WinBackAutomationsCard
        setting={setting}
        connection={connection}
        stats={stats}
      />

      {/* ── Manual-mode banner ──────────────────────────────────────────── */}
      <div
        className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
        style={{
          background: "rgba(59,122,181,0.07)",
          border: "1px solid rgba(59,122,181,0.18)",
        }}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#3b7ab5" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "#2a5a8a" }}>
            {c.manualModeLabel}
          </p>
          <p className="mt-0.5 text-sm" style={{ color: "#3b7ab5" }}>
            {c.manualModeBanner}
          </p>
        </div>
        <span
          className="ms-auto shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{
            background: "rgba(59,122,181,0.12)",
            color: "#3b7ab5",
          }}
        >
          {c.autoModeLabel}
        </span>
      </div>

      {/* ── Main two-column layout on large screens ─────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Settings — narrower column */}
        <div className="lg:col-span-2">
          <div
            className="rounded-2xl p-5"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <h2
              className="mb-1 text-base font-bold"
              style={{ color: "var(--foreground)" }}
            >
              {c.settings.sectionTitle}
            </h2>
            <p className="mb-5 text-sm" style={{ color: "var(--muted)" }}>
              {c.sectionSubtitle}
            </p>

            <ReminderSettingsForm settings={settings} />
          </div>
        </div>

        {/* Reminders due list — wider column */}
        <div className="lg:col-span-3">
          <div
            className="rounded-2xl"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div>
                <h2
                  className="text-base font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  {c.dueList.sectionTitle}
                </h2>
                <p className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>
                  {c.dueList.sectionSubtitle}
                </p>
              </div>
              {remindersDue.length > 0 && (
                <span
                  className="rounded-full px-3 py-1 text-sm font-semibold"
                  style={{
                    background: "rgba(184,107,140,0.10)",
                    color: "#b86b8c",
                  }}
                >
                  {remindersDue.length}
                </span>
              )}
            </div>

            {/* List */}
            <div className="p-4">
              <RemindersDueList
                remindersDue={remindersDue}
                reminderHours={settings.reminderHoursBefore}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
