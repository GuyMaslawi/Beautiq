"use client";

import { useState, useTransition } from "react";
import { Settings, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toggleWinBackAutomation } from "@/server/win-back-automation/actions";
import { WinBackSettingsForm } from "@/components/win-back-automation/win-back-settings-form";
import type { AutomationSetting } from "@prisma/client";

interface Props {
  setting: AutomationSetting | null;
}

export function WinBackAutomationCard({ setting }: Props) {
  const [isEnabled, setIsEnabled] = useState(setting?.enabled ?? false);
  const [isToggling, startToggle] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleToggle = () => {
    const next = !isEnabled;
    setIsEnabled(next);
    startToggle(async () => {
      const result = await toggleWinBackAutomation(next);
      if (!result.success) setIsEnabled(!next);
    });
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
        {/* Title + switch in one row */}
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

        {/* Status */}
        <p
          className="text-xs font-semibold"
          style={{ color: isEnabled ? "#16a34a" : "var(--muted)" }}
        >
          {isEnabled ? "פעיל" : "כבוי"}
        </p>

        {/* Description */}
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          לקוחות שלא חזרו יקבלו הודעת WhatsApp אוטומטית.
        </p>

        {/* Settings button */}
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
      </div>

      {/* Settings dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDialogOpen(false)}
          />
          <div
            className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", maxHeight: "90dvh" }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
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
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(90dvh - 4rem)" }}>
              <WinBackSettingsForm
                setting={setting}
                currentEnabled={isEnabled}
                onSaved={() => setDialogOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
