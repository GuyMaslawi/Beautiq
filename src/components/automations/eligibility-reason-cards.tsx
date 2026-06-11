"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PhoneOff,
  BellOff,
  ShieldAlert,
  CalendarCheck,
  Clock,
  Hourglass,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import type { BlockedClientsByReason, BlockedClientPreview } from "@/server/win-back-automation/manual-run-action";

// ---------------------------------------------------------------------------
// Reason config
// ---------------------------------------------------------------------------

type NonEligibleReason = Exclude<
  keyof Omit<BlockedClientsByReason, "counts">,
  never
>;

interface ReasonConfig {
  key: NonEligibleReason;
  icon: React.ElementType;
  colorHex: string;
  bgAlpha: string;
  borderAlpha: string;
  title: string;
  description: string;
  fixHint: string;
  isFixable: boolean;
}

const REASON_CONFIGS: ReasonConfig[] = [
  {
    key: "invalidPhone",
    icon: PhoneOff,
    colorHex: "#8b2e2e",
    bgAlpha: "rgba(190,74,74,0.07)",
    borderAlpha: "rgba(190,74,74,0.20)",
    title: "אין מספר טלפון תקין",
    description: "ללקוחה אין מספר טלפון תקין ולכן לא ניתן לשלוח הודעה.",
    fixHint: "כדאי לעדכן מספר טלפון בכרטיס הלקוחה.",
    isFixable: true,
  },
  {
    key: "unsubscribed",
    icon: BellOff,
    colorHex: "#8b2e2e",
    bgAlpha: "rgba(190,74,74,0.07)",
    borderAlpha: "rgba(190,74,74,0.20)",
    title: "הסירה את עצמה מהודעות",
    description: "הלקוחה בחרה שלא לקבל הודעות.",
    fixHint: "לא ניתן לשלוח הודעה ללקוחה שביקשה להסיר את עצמה.",
    isFixable: false,
  },
  {
    key: "noOptIn",
    icon: ShieldAlert,
    colorHex: "#b45309",
    bgAlpha: "rgba(234,179,8,0.07)",
    borderAlpha: "rgba(234,179,8,0.22)",
    title: "לא אישרה קבלת הודעות WhatsApp",
    description: "הלקוחה לא אישרה קבלת הודעות WhatsApp.",
    fixHint: "אפשר לעדכן את העדפות הלקוחה אם התקבלה ממנה הסכמה.",
    isFixable: true,
  },
  {
    key: "hasFutureBooking",
    icon: CalendarCheck,
    colorHex: "#2e5c8a",
    bgAlpha: "rgba(59,122,181,0.07)",
    borderAlpha: "rgba(59,122,181,0.22)",
    title: "יש לה תור עתידי",
    description: "ללקוחה כבר יש תור עתידי, ולכן אין צורך לשלוח לה הודעת החזרה.",
    fixHint: "אין צורך לבצע פעולה — הלקוחה כבר קבעה תור.",
    isFixable: false,
  },
  {
    key: "inCooldown",
    icon: Clock,
    colorHex: "#4a5568",
    bgAlpha: "rgba(148,163,184,0.07)",
    borderAlpha: "rgba(148,163,184,0.22)",
    title: "נשלחה הודעה לאחרונה",
    description: "נשלחה ללקוחה הודעה לאחרונה, ולכן היא בתקופת המתנה.",
    fixHint: "אין צורך לבצע פעולה כרגע — המערכת ממתינה לפני שליחה נוספת.",
    isFixable: false,
  },
  {
    key: "noCompletedBooking",
    icon: Hourglass,
    colorHex: "#4a5568",
    bgAlpha: "rgba(148,163,184,0.07)",
    borderAlpha: "rgba(148,163,184,0.22)",
    title: "עדיין לא הגיע הזמן לשלוח",
    description:
      "עדיין לא עברו מספיק ימים מאז הביקור האחרון, או שהלקוחה עדיין לא ביצעה ביקור מוגמר.",
    fixHint: "אין צורך לבצע פעולה — המערכת תשלח אוטומטית כשיגיע הזמן.",
    isFixable: false,
  },
];

// ---------------------------------------------------------------------------
// ReasonCard sub-component
// ---------------------------------------------------------------------------

function ReasonCard({
  config,
  count,
  clients,
}: {
  config: ReasonConfig;
  count: number;
  clients: BlockedClientPreview[];
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = config.icon;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: config.bgAlpha,
        border: `1px solid ${config.borderAlpha}`,
      }}
    >
      {/* Card header row */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5"
          style={{ background: config.bgAlpha, border: `1px solid ${config.borderAlpha}` }}
        >
          <Icon className="h-4 w-4" style={{ color: config.colorHex }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold leading-snug" style={{ color: config.colorHex }}>
              {config.title}
            </p>
            <span
              className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums"
              style={{
                background: config.borderAlpha,
                color: config.colorHex,
              }}
            >
              {count} לקוחות
            </span>
          </div>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--foreground-soft)" }}>
            {config.description}
          </p>
          {config.fixHint && (
            <p
              className="text-xs mt-1 font-medium"
              style={{ color: config.isFixable ? "#2a6e57" : "var(--muted)" }}
            >
              {config.isFixable ? "💡 " : ""}
              {config.fixHint}
            </p>
          )}
        </div>

        {/* Expand toggle */}
        {clients.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 transition-all hover:opacity-80"
            style={{
              color: config.colorHex,
              background: config.borderAlpha,
              border: `1px solid ${config.borderAlpha}`,
            }}
          >
            <span>הצג לקוחות</span>
            <ChevronDown
              className="h-3 w-3 transition-transform"
              style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>
        )}
      </div>

      {/* Expandable client list */}
      {expanded && clients.length > 0 && (
        <div
          className="border-t divide-y"
          style={{
            borderColor: config.borderAlpha,
          }}
        >
          {clients.map((client) => (
            <div
              key={client.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-white/30 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--foreground)" }}
                >
                  {client.fullName}
                </span>
                <span
                  className="text-xs tabular-nums shrink-0"
                  style={{ color: "var(--muted)" }}
                >
                  {client.maskedPhone}
                </span>
              </div>
              <Link
                href={`/clients/${client.id}`}
                className="shrink-0 flex items-center gap-1 text-xs rounded-lg px-2 py-1 transition-all hover:opacity-80"
                style={{
                  color: config.colorHex,
                  background: "rgba(255,255,255,0.5)",
                  border: `1px solid ${config.borderAlpha}`,
                }}
              >
                פרטים
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          ))}
          {clients.length === 50 && (
            <p
              className="px-4 py-2 text-[11px]"
              style={{ color: "var(--muted)" }}
            >
              מוצגות עד 50 לקוחות לכל סיבה
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EligibilityReasonCards({
  blockedClients,
  realSendConfigured,
  whatsappConnected,
}: {
  blockedClients: BlockedClientsByReason;
  realSendConfigured: boolean;
  whatsappConnected: boolean;
}) {
  const { counts } = blockedClients;
  const blockedCount = counts.total - counts.eligible;

  // Filter to reasons with at least one client
  const activeReasons = REASON_CONFIGS.filter(
    (cfg) => counts[cfg.key] > 0,
  );

  return (
    <div className="space-y-4" dir="rtl">
      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className="rounded-xl px-4 py-3 text-center"
          style={{
            background: "rgba(61,139,110,0.08)",
            border: "1px solid rgba(61,139,110,0.20)",
          }}
        >
          <p className="text-2xl font-bold tabular-nums" style={{ color: "#2a6e57" }}>
            {counts.eligible}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#2a6e57" }}>
            זכאיות לשליחה
          </p>
        </div>
        <div
          className="rounded-xl px-4 py-3 text-center"
          style={{
            background: blockedCount > 0 ? "rgba(190,74,74,0.07)" : "rgba(148,163,184,0.07)",
            border: `1px solid ${blockedCount > 0 ? "rgba(190,74,74,0.20)" : "rgba(148,163,184,0.20)"}`,
          }}
        >
          <p
            className="text-2xl font-bold tabular-nums"
            style={{ color: blockedCount > 0 ? "#8b2e2e" : "var(--muted)" }}
          >
            {blockedCount}
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: blockedCount > 0 ? "#8b2e2e" : "var(--muted)" }}
          >
            לא זכאיות
          </p>
        </div>
      </div>

      {/* WhatsApp system card — shown only when disconnected/unconfigured */}
      {(!realSendConfigured || !whatsappConnected) && (
        <div
          className="rounded-xl px-4 py-3 flex items-start gap-3"
          style={{
            background: "rgba(190,74,74,0.07)",
            border: "1px solid rgba(190,74,74,0.20)",
          }}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "rgba(190,74,74,0.12)" }}
          >
            <ShieldAlert className="h-4 w-4" style={{ color: "#8b2e2e" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#8b2e2e" }}>
              WhatsApp לא מחובר
            </p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--foreground-soft)" }}>
              {!realSendConfigured
                ? "העסק עדיין לא מגדיר WhatsApp Business ולכן לא ניתן לשלוח הודעות אמיתיות."
                : "חיבור WhatsApp Business לא פעיל. יש לבדוק את הגדרות הערוץ."}
            </p>
            <p className="text-xs mt-1 font-medium" style={{ color: "var(--muted)" }}>
              האוטומציה תתחיל לשלוח ברגע ש-WhatsApp יחובר.
            </p>
          </div>
        </div>
      )}

      {/* Blocked reasons section */}
      {blockedCount > 0 && (
        <div className="space-y-2">
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              למה חלק מהלקוחות לא יקבלו הודעה?
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              כאן אפשר לראות אילו לקוחות לא זכאיות כרגע לקבל הודעת WhatsApp ולמה.
            </p>
          </div>

          {activeReasons.map((cfg) => (
            <ReasonCard
              key={cfg.key}
              config={cfg}
              count={counts[cfg.key]}
              clients={blockedClients[cfg.key]}
            />
          ))}
        </div>
      )}

      {/* All eligible — happy path */}
      {blockedCount === 0 && counts.eligible > 0 && (
        <div
          className="rounded-xl px-4 py-3"
          style={{
            background: "rgba(61,139,110,0.06)",
            border: "1px solid rgba(61,139,110,0.18)",
          }}
        >
          <p className="text-sm font-medium" style={{ color: "#2a6e57" }}>
            כל הלקוחות הפעילות זכאיות לשליחה
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#2a6e57" }}>
            אין חסמים. האוטומציה יכולה לשלוח הודעות לכל {counts.eligible} הלקוחות.
          </p>
        </div>
      )}

      {/* No clients at all */}
      {counts.total === 0 && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          אין לקוחות בעסק כרגע.
        </p>
      )}
    </div>
  );
}
