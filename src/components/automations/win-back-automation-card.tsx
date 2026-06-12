"use client";

import { useState, useTransition } from "react";
import { Settings, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toggleWinBackAutomation } from "@/server/win-back-automation/actions";
import { WinBackSettingsForm } from "@/components/win-back-automation/win-back-settings-form";
import { DEFAULT_WIN_BACK_TEMPLATE } from "@/server/win-back-automation/message-builder";
import { AutomationLastRunSummary } from "@/components/automations/automation-last-run-summary";
import type { AutomationSetting } from "@prisma/client";
import type { LastRunSummary } from "@/server/automations/run-queries";

const OFFER_PREVIEW_TEXTS: Record<string, string> = {
  none: "",
  discount_10: "מגיעה לך הנחה של 10% בתור הבא 🎁",
  upgrade: "שדרוג טיפול מתנה בתור הקרוב 🌟",
  special_slot: "יש לנו תור פנוי מיוחד בשבוע הקרוב — רק בשבילך 🗓️",
};

function buildPreview(template: string, offerType: string, offerValue: string): string {
  const offerText = offerType === "custom" ? offerValue : (OFFER_PREVIEW_TEXTS[offerType] ?? "");
  return template
    .replace(/\{שם\}/g, "רחל כהן")
    .replace(/\{שם_העסק\}/g, "מספרה לדוגמה")
    .replace(/\{שירות_אחרון\}/g, "צביעת שיער")
    .replace(/\{הטבה\}/g, offerText)
    .replace(/\{קישור_להזמנה\}/g, "allura.app/b/example")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

interface Props {
  setting: AutomationSetting | null;
  lastRun?: LastRunSummary | null;
}

export function WinBackAutomationCard({ setting, lastRun }: Props) {
  const [isEnabled, setIsEnabled] = useState(setting?.enabled ?? false);
  const [isToggling, startToggle] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  const [previewTemplate, setPreviewTemplate] = useState(
    setting?.messageTemplate ?? DEFAULT_WIN_BACK_TEMPLATE,
  );
  const [previewOfferType, setPreviewOfferType] = useState(
    (setting?.offerType as string) ?? "none",
  );
  const [previewOfferValue, setPreviewOfferValue] = useState(setting?.offerValue ?? "");

  const handleToggle = () => {
    const next = !isEnabled;
    setIsEnabled(next);
    startToggle(async () => {
      const result = await toggleWinBackAutomation(next);
      if (!result.success) setIsEnabled(!next);
    });
  };

  const handlePreviewChange = (template: string, offerType: string, offerValue: string) => {
    setPreviewTemplate(template);
    setPreviewOfferType(offerType);
    setPreviewOfferValue(offerValue);
  };

  const previewText = buildPreview(previewTemplate, previewOfferType, previewOfferValue);

  const previewBubble = (
    <div
      className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-loose w-full"
      style={{
        background: "#fff",
        color: "#111",
        whiteSpace: "pre-wrap",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        direction: "rtl",
      }}
    >
      {previewText}
    </div>
  );

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
        {/* Title + switch */}
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            החזרת לקוחות
          </h3>
          <Switch
            checked={isEnabled}
            onCheckedChange={() => handleToggle()}
            disabled={isToggling}
            aria-label="הפעלת החזרת לקוחות"
          />
        </div>

        <p className="text-xs font-semibold" style={{ color: isEnabled ? "#16a34a" : "var(--muted)" }}>
          {isEnabled ? "פעיל" : "כבוי"}
        </p>

        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          לקוחות שלא חזרו יקבלו הודעת WhatsApp אוטומטית כדי לעודד חזרה.
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
          <Settings className="h-4 w-4" />
          הגדרות
        </button>

        <AutomationLastRunSummary lastRun={lastRun ?? null} />
      </div>

      {/* Settings dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDialogOpen(false)} />

          <div
            className="relative w-full sm:max-w-3xl flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[90dvh]"
            style={{ background: "var(--surface)" }}
          >
            {/* Header */}
            <div
              className="flex-shrink-0 flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
                הגדרות החזרת לקוחות
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

            {/* Body — scrollable, 2-col on desktop */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="sm:grid sm:grid-cols-[1fr_300px] sm:min-h-full">

                {/* Config col — right in RTL */}
                <div className="p-5 space-y-4">
                  {/* Explanation */}
                  <div
                    className="rounded-xl px-4 py-3"
                    style={{
                      background: "rgba(201,120,152,0.06)",
                      border: "1px solid rgba(201,120,152,0.12)",
                    }}
                  >
                    <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--foreground)" }}>
                      הודעה אוטומטית ללקוחות שלא חזרו
                    </p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>
                      לקוחות שלא קבעו תור תקבלנה הצעה שתחזיר אותן.
                    </p>
                  </div>

                  {/* Preview — mobile only */}
                  <div className="sm:hidden space-y-2">
                    <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>
                      ✓ כך ההודעה תישלח ללקוחה
                    </p>
                    <div
                      className="rounded-2xl p-4"
                      style={{
                        background: "rgba(37,211,102,0.05)",
                        border: "1px solid rgba(37,211,102,0.2)",
                      }}
                    >
                      {previewBubble}
                    </div>
                  </div>

                  <WinBackSettingsForm
                    setting={setting}
                    currentEnabled={isEnabled}
                    onSaved={() => setDialogOpen(false)}
                    onPreviewChange={handlePreviewChange}
                  />
                </div>

                {/* Preview col — desktop only, left in RTL */}
                <div
                  className="hidden sm:flex flex-col p-5 gap-4"
                  style={{ borderRight: "1px solid var(--border)" }}
                >
                  <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>
                    ✓ כך ההודעה תישלח ללקוחה
                  </p>
                  <div
                    className="rounded-2xl p-4 flex-1"
                    style={{
                      background: "rgba(37,211,102,0.05)",
                      border: "1px solid rgba(37,211,102,0.2)",
                    }}
                  >
                    {previewBubble}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
