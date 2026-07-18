"use client";

import { useState, useTransition } from "react";
import { X, Lock, MessageCircle } from "lucide-react";
import { saveBookingConfirmationSettingsAction } from "@/server/booking-confirmation/actions";
import { AutomationLastRunSummary } from "@/components/automations/automation-last-run-summary";
import { TemplateReadinessBadge } from "@/components/automations/template-readiness-badge";
import type { AutomationSetting } from "@prisma/client";
import type { LastRunSummary } from "@/server/automations/run-queries";

interface Props {
  setting: AutomationSetting | null;
  lastRun?: LastRunSummary | null;
  realSendConfigured?: boolean;
  testMode?: boolean;
  isAdmin?: boolean;
  /** True before WhatsApp is connected — the card is shown but locked. */
  locked?: boolean;
}

export function BookingConfirmationCard({
  setting,
  lastRun,
  realSendConfigured = false,
  testMode = false,
  isAdmin = false,
  locked = false,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState(setting?.templateName ?? "");
  const [templateLanguage, setTemplateLanguage] = useState(setting?.templateLanguage ?? "he");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveBookingConfirmationSettingsAction({
        requireOptIn: false,
        templateName: templateName.trim() || null,
        templateLanguage: templateLanguage.trim() || "he",
      });
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
      : "linear-gradient(135deg, #c76f93 0%, #ac5c7f 100%)",
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
          <MessageCircle className="h-4 w-4 shrink-0" style={{ color: "#c76f93" }} />
          <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            אישור תור
          </h3>
        </div>

        {locked ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--muted)" }}>
            <Lock className="h-3 w-3 shrink-0" />
            זמין אחרי חיבור WhatsApp
          </p>
        ) : (
          <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>
            פעיל תמיד
          </p>
        )}

        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          הודעה אוטומטית ללקוחה מיד לאחר שהיא שולחת בקשת תור.
        </p>

        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          disabled={locked && !isAdmin}
          className="mt-1 flex items-center gap-2 self-start rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "var(--background-alt)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        >
          הגדרה
        </button>

        {!locked && (
          <TemplateReadinessBadge
            realSendConfigured={realSendConfigured}
            testMode={testMode}
            isAdmin={isAdmin}
            templateName={setting?.templateName}
            templateStatus={setting?.templateStatus}
          />
        )}

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
                  background: "rgba(199,111,147,0.06)",
                  border: "1px solid rgba(199,111,147,0.12)",
                }}
              >
                <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--foreground)" }}>
                  אישור תור — הודעה עסקית אוטומטית
                </p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>
                  נשלחת מיד לאחר כל בקשת תור שהתקבלה. ההודעה מאשרת ללקוחה שהבקשה נתקבלה ומצוינת פרטי התור.
                </p>
              </div>

              {/* WhatsApp template configuration */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                    שם תבנית WhatsApp
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    dir="ltr"
                    className="w-full rounded-xl px-4 py-2.5 text-sm"
                    style={{
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                    }}
                    placeholder="booking_confirmation_he"
                  />
                  <p className="text-xs mt-1 leading-snug" style={{ color: "var(--muted)" }}>
                    יש להזין את שם התבנית כפי שאושרה ב־WhatsApp Business.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                    שפת התבנית
                  </label>
                  <input
                    type="text"
                    value={templateLanguage}
                    onChange={(e) => setTemplateLanguage(e.target.value)}
                    dir="ltr"
                    className="w-full rounded-xl px-4 py-2.5 text-sm"
                    style={{
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                    }}
                    placeholder="he"
                  />
                </div>
              </div>

              {/* Admin diagnostic note */}
              {isAdmin && (
                <div
                  className="rounded-xl px-4 py-3"
                  style={{
                    background: "rgba(107,114,128,0.06)",
                    border: "1px solid rgba(107,114,128,0.18)",
                  }}
                >
                  <p className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>
                    Admin — סטטוס תבנית
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    סוג אוטומציה:{" "}
                    <span className="font-mono" style={{ color: "var(--foreground)" }}>
                      booking_confirmation
                    </span>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                    שם תבנית:{" "}
                    <span className="font-mono" style={{ color: templateName ? "var(--foreground)" : "#b45309" }}>
                      {templateName || "לא מוגדר"}
                    </span>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                    שפה:{" "}
                    <span className="font-mono" style={{ color: "var(--foreground)" }}>
                      {templateLanguage || "he"}
                    </span>
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
