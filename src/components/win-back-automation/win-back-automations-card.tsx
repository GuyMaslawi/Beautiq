import Link from "next/link";
import { RefreshCcw, Zap, ZapOff, AlertCircle, ArrowLeft } from "lucide-react";
import { WIN_BACK_AUTOMATION } from "@/lib/constants/he";
import type { AutomationSetting, WhatsAppConnection } from "@prisma/client";
import type { WinBackStats } from "@/server/win-back-automation/queries";

const c = WIN_BACK_AUTOMATION.automationsCard;

interface Props {
  setting: AutomationSetting | null;
  connection: WhatsAppConnection | null;
  stats: WinBackStats;
}

export function WinBackAutomationsCard({ setting, connection, stats }: Props) {
  const isEnabled = setting?.enabled ?? false;
  const hasProvider =
    connection?.status === "active" || connection?.provider === "dev_mock";

  const statusColor = isEnabled && hasProvider
    ? "#15803d"
    : !hasProvider
    ? "#dc2626"
    : "#6b7280";

  const statusBg = isEnabled && hasProvider
    ? "rgba(22,163,74,0.08)"
    : !hasProvider
    ? "rgba(220,38,38,0.07)"
    : "rgba(107,114,128,0.08)";

  const statusLabel = isEnabled && hasProvider
    ? c.statusEnabled
    : !hasProvider
    ? c.statusNoProvider
    : c.statusDisabled;

  const StatusIcon = isEnabled && hasProvider ? Zap : !hasProvider ? AlertCircle : ZapOff;

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-4 px-5 py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: "rgba(184,107,140,0.10)",
          }}
        >
          <RefreshCcw className="h-5 w-5" style={{ color: "#b86b8c" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
              {c.title}
            </h3>
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: statusBg, color: statusColor }}
            >
              <StatusIcon className="h-2.5 w-2.5" />
              {statusLabel}
            </span>
            {setting?.thresholdDays && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background: "var(--background-alt)",
                  color: "var(--muted)",
                  border: "1px solid var(--border)",
                }}
              >
                {c.thresholdBadge(setting.thresholdDays)}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
            {c.subtitle}
          </p>
        </div>
      </div>

      {/* Stats + CTA */}
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--muted)" }}>
          <span>
            <span className="font-bold tabular-nums" style={{ color: "#3b7ab5" }}>
              {stats.realSentThisMonth}
            </span>{" "}
            {c.sentBadge(stats.realSentThisMonth).split(" ")[1]}
          </span>
          {stats.failedThisMonth > 0 && (
            <span>
              <span className="font-bold tabular-nums" style={{ color: "#dc2626" }}>
                {stats.failedThisMonth}
              </span>{" "}
              {WIN_BACK_AUTOMATION.statusPanel.failedThisMonth(stats.failedThisMonth).split(" ")[1]}
            </span>
          )}
        </div>
        <Link
          href="/bring-back"
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
          }}
        >
          {c.manageCta}
          <ArrowLeft className="h-3 w-3 rotate-180" />
        </Link>
      </div>
    </div>
  );
}
