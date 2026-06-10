"use client";

import { useState, useTransition } from "react";
import { WIN_BACK_AUTOMATION } from "@/lib/constants/he";
import { saveWinBackAutomationSetting } from "@/server/win-back-automation/actions";
import { DEFAULT_WIN_BACK_TEMPLATE } from "@/server/win-back-automation/message-builder";
import type { AutomationSetting } from "@prisma/client";

const c = WIN_BACK_AUTOMATION.settings;

const OFFER_PREVIEW_TEXTS: Record<string, string> = {
  none: "",
  discount_10: "מגיעה לך הנחה של 10% בתור הבא 🎁",
  upgrade: "שדרוג טיפול מתנה בתור הקרוב 🌟",
  special_slot: "יש לנו תור פנוי מיוחד בשבוע הקרוב — רק בשבילך 🗓️",
};

function buildMessagePreview(template: string, offerType: string, offerValue: string): string {
  const offerText =
    offerType === "custom" ? offerValue : (OFFER_PREVIEW_TEXTS[offerType] ?? "");
  return template
    .replace(/\{שם\}/g, "רחל כהן")
    .replace(/\{שם_העסק\}/g, "מספרה לדוגמה")
    .replace(/\{שירות_אחרון\}/g, "צביעת שיער")
    .replace(/\{הטבה\}/g, offerText)
    .replace(/\{קישור_להזמנה\}/g, "allura.app/b/example")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

const THRESHOLD_OPTIONS = [30, 45, 60, 90];

const SEND_TIME_OPTIONS = [
  { hour: 9, label: "09:00 — בוקר" },
  { hour: 12, label: "12:00 — צהריים" },
  { hour: 18, label: "18:00 — ערב" },
];

const OFFER_OPTIONS = [
  { value: "none" as const, label: "ללא הטבה" },
  { value: "discount_10" as const, label: "10% הנחה" },
  { value: "custom" as const, label: "הטבה אישית" },
];

interface Props {
  setting: AutomationSetting | null;
  currentEnabled: boolean;
  onSaved?: () => void;
}

export function WinBackSettingsForm({ setting, currentEnabled, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [thresholdDays, setThresholdDays] = useState(setting?.thresholdDays ?? 45);
  const [sendHour, setSendHour] = useState(setting?.sendHour ?? 12);
  const [messageTemplate, setMessageTemplate] = useState(
    setting?.messageTemplate ?? DEFAULT_WIN_BACK_TEMPLATE,
  );
  const [offerType, setOfferType] = useState<"none" | "discount_10" | "upgrade" | "special_slot" | "custom">(
    (setting?.offerType as "none") ?? "none",
  );
  const [offerValue, setOfferValue] = useState(setting?.offerValue ?? "");

  const handleSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveWinBackAutomationSetting({
        enabled: currentEnabled,
        thresholdDays,
        sendHour,
        messageTemplate: messageTemplate || null,
        offerType,
        offerValue: offerType === "custom" ? offerValue : null,
        // Preserve existing values for fields not exposed in this form
        cooldownDays: setting?.cooldownDays ?? 30,
        requireOptIn: setting?.requireOptIn ?? true,
        templateName: setting?.templateName ?? null,
        templateLanguage: setting?.templateLanguage ?? "he",
      });
      if (result.success) {
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
          onSaved?.();
        }, 1200);
      } else {
        setError(result.error ?? c.saveError);
      }
    });
  };

  const chipActive = {
    background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
    color: "#fff",
    border: "none",
  };
  const chipInactive = {
    background: "var(--background-alt)",
    color: "var(--muted)",
    border: "1px solid var(--border)",
  };
  const inputStyle = {
    border: "1px solid var(--border)",
    background: "var(--background)",
    color: "var(--foreground)",
    borderRadius: "0.5rem",
    padding: "0.5rem 0.75rem",
    fontSize: "0.875rem",
    width: "100%",
  };

  return (
    <div className="space-y-6">

      {/* 1. מתי לפנות ללקוחה */}
      <div className="space-y-2.5">
        <label className="block text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          מתי לפנות ללקוחה?
        </label>
        <div className="flex flex-wrap gap-2">
          {THRESHOLD_OPTIONS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setThresholdDays(days)}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
              style={thresholdDays === days ? chipActive : chipInactive}
            >
              {days} ימים
            </button>
          ))}
        </div>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          ללקוחות שלא קבעו תור מאז התקופה הזו
        </p>
      </div>

      {/* 2. איזו הטבה להציע */}
      <div className="space-y-2.5">
        <label className="block text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          איזו הטבה להציע?
        </label>
        <div className="flex flex-wrap gap-2">
          {OFFER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setOfferType(opt.value)}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
              style={offerType === opt.value ? chipActive : chipInactive}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {offerType === "custom" && (
          <input
            type="text"
            value={offerValue}
            onChange={(e) => setOfferValue(e.target.value)}
            placeholder="לדוגמה: מגיעה לך הנחה של 15% 🎁"
            style={inputStyle}
          />
        )}
      </div>

      {/* 3. מתי לשלוח */}
      <div className="space-y-2.5">
        <label className="block text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          מתי לשלוח?
        </label>
        <div className="flex flex-wrap gap-2">
          {SEND_TIME_OPTIONS.map((p) => (
            <button
              key={p.hour}
              type="button"
              onClick={() => setSendHour(p.hour)}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
              style={sendHour === p.hour ? chipActive : chipInactive}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. נוסח ההודעה */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            נוסח ההודעה
          </label>
          <button
            type="button"
            onClick={() => setMessageTemplate(DEFAULT_WIN_BACK_TEMPLATE)}
            className="text-xs transition-opacity hover:opacity-70"
            style={{ color: "var(--muted)" }}
          >
            איפוס לברירת מחדל
          </button>
        </div>
        <textarea
          rows={4}
          value={messageTemplate}
          onChange={(e) => setMessageTemplate(e.target.value)}
          placeholder={c.templatePlaceholder}
          className="resize-none leading-relaxed"
          style={{ ...inputStyle, direction: "rtl" }}
        />
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {c.templateHelper}
        </p>

        {/* Message preview */}
        <div
          className="rounded-xl p-3.5 text-sm leading-relaxed"
          style={{
            background: "rgba(37,211,102,0.05)",
            border: "1px solid rgba(37,211,102,0.15)",
            color: "var(--foreground)",
            whiteSpace: "pre-wrap",
            direction: "rtl",
          }}
        >
          {buildMessagePreview(messageTemplate, offerType, offerValue)}
        </div>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {c.messagePreviewNote}
        </p>
      </div>

      {error && (
        <p className="text-sm" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={handleSave}
        className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{
          background: saved
            ? "linear-gradient(135deg, #3d8b6e 0%, #2d7060 100%)"
            : "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
        }}
      >
        {isPending ? c.saving : saved ? c.saved : c.saveButton}
      </button>
    </div>
  );
}
