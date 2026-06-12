"use client";

import { useState, useTransition } from "react";
import { X, CheckCircle, AlertTriangle, FlaskConical, ShieldCheck, MessageCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { saveBookingConfirmationSettingsAction } from "@/server/booking-confirmation/actions";
import { AutomationLastRunSummary } from "@/components/automations/automation-last-run-summary";
import type { AutomationSetting } from "@prisma/client";
import type { LastRunSummary } from "@/server/automations/run-queries";

function TemplateReadinessBadge({
  realSendConfigured,
  testMode,
  hasTemplate,
}: {
  realSendConfigured: boolean;
  testMode: boolean;
  hasTemplate: boolean;
}) {
  if (!realSendConfigured) return null;
  if (testMode) {
    return (
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "#b45309" }}>
        <FlaskConical className="h-3 w-3 shrink-0" />
        מצב בדיקה פעיל
      </div>
    );
  }
  if (hasTemplate) {
    return (
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "#15803d" }}>
        <CheckCircle className="h-3 w-3 shrink-0" />
        תבנית מוגדרת
      </div>
    );
  }
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "#b45309" }}>
        <AlertTriangle className="h-3 w-3 shrink-0" />
        חסרה תבנית הודעה
      </div>
      <p className="text-xs leading-snug" style={{ color: "var(--muted)" }}>
        כדי לשלוח הודעות אמיתיות, צריך להגדיר תבנית WhatsApp מאושרת.
      </p>
    </div>
  );
}

interface Props {
  setting: AutomationSetting | null;
  lastRun?: LastRunSummary | null;
  realSendConfigured?: boolean;
  testMode?: boolean;
  isAdmin?: boolean;
}

export function BookingConfirmationCard({
  setting,
  lastRun,
  realSendConfigured = false,
  testMode = false,
  isAdmin = false,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requireOptIn, setRequireOptIn] = useState(setting?.requireOptIn ?? false);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveBookingConfirmationSettingsAction({ requireOptIn });
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
          setDialogOpen(false);
        }, 1200);
      }
    });
  };

  const saveBtnText = isPending ? "שומר…" : saved ? "נשמר ✓" : "שמור";
  const saveBtnStyle = {
    background: saved
      ? "linear-gradient(135deg, #3d8b6e 0%, #2d7060 100%)"
      : "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
  };

  return (
    <>
      <div
        className="flex flex-col rounded-2xl p-4 gap-2.5"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex items-center gap-3">
          <MessageCircle className="h-4 w-4 shrink-0" style={{ color: "#c97898" }} />
          <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            אישור תור
          </h3>
        </div>

        <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>
          פעיל תמיד
        </p>

        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          הודעה אוטומטית ללקוחה מיד לאחר שהיא שולחת בקשת תור.
        </p>

        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="mt-1 flex items-center gap-2 self-start rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
          style={{
            background: "var(--background-alt)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        >
          הגדרה
        </button>

        <TemplateReadinessBadge
          realSendConfigured={realSendConfigured}
          testMode={testMode}
          hasTemplate={!!setting?.templateName}
        />

        <AutomationLastRunSummary lastRun={lastRun ?? null} />
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDialogOpen(false)} />

          <div
            className="relative w-full sm:max-w-lg flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[90dvh]"
            style={{ background: "var(--surface)" }}
          >
            {/* Header */}
            <div
              className="flex-shrink-0 flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
                הגדרות אישור תור
              </h2>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="rounded-full p-1.5 transition-opacity hover:opacity-70"
                style={{ color: "var(--muted)" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-5">
              {/* Explanation */}
              <div
                className="rounded-xl px-4 py-3"
                style={{
                  background: "rgba(201,120,152,0.06)",
                  border: "1px solid rgba(201,120,152,0.12)",
                }}
              >
                <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--foreground)" }}>
                  אישור תור — הודעה עסקית אוטומטית
                </p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>
                  נשלחת מיד לאחר כל בקשת תור שהתקבלה. ההודעה מאשרת ללקוחה שהבקשה נתקבלה ומצוינת פרטי התור.
                </p>
              </div>

              {/* requireOptIn toggle */}
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#c97898" }} />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium leading-snug" style={{ color: "var(--foreground)" }}>
                      שלח רק ללקוחות שאישרו הודעות WhatsApp
                    </label>
                    <Switch
                      checked={requireOptIn}
                      onCheckedChange={setRequireOptIn}
                      aria-label="דרישת אישור WhatsApp"
                    />
                  </div>
                  <p className="mt-1 text-xs leading-snug" style={{ color: "var(--muted)" }}>
                    {requireOptIn
                      ? "אישורי תור יישלחו רק ללקוחות שנתנו הסכמה מפורשת."
                      : "מומלץ: אישור תור הוא הודעה עסקית — נשלחת לכל הלקוחות."}
                  </p>
                </div>
              </div>

              {/* Admin-only: template name note */}
              {isAdmin && (
                <div
                  className="rounded-xl px-4 py-3"
                  style={{
                    background: "rgba(107,114,128,0.06)",
                    border: "1px solid rgba(107,114,128,0.18)",
                  }}
                >
                  <p className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>
                    Admin — תבנית Meta
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    שם תבנית:{" "}
                    <span className="font-mono" style={{ color: "var(--foreground)" }}>
                      {setting?.templateName ?? "לא מוגדר"}
                    </span>
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    שינוי שם התבנית נעשה דרך הגדרות WhatsApp של העסק.
                  </p>
                </div>
              )}

              {error && (
                <p className="text-sm" style={{ color: "#dc2626" }}>
                  {error}
                </p>
              )}
            </div>

            {/* Sticky save */}
            <div
              className="flex-shrink-0 p-4"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <button
                type="button"
                disabled={isPending}
                onClick={handleSave}
                className="w-full rounded-2xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={saveBtnStyle}
              >
                {saveBtnText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
