"use client";

import { useState, useTransition } from "react";
import { ChevronDown, FlaskConical, AlertTriangle } from "lucide-react";
import { WIN_BACK_AUTOMATION } from "@/lib/constants/he";
import { saveWinBackAutomationSetting } from "@/server/win-back-automation/actions";
import { DEFAULT_WIN_BACK_TEMPLATE } from "@/server/win-back-automation/message-builder";
import type { AutomationSetting } from "@prisma/client";

const c = WIN_BACK_AUTOMATION.settings;
const tm = c.testMode;

const PRESET_DAYS = [30, 60, 90] as const;
type PresetDays = typeof PRESET_DAYS[number];

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

function getInitialThresholdSelection(savedDays: number): { selected: PresetDays | "custom"; customInput: string } {
  if ((PRESET_DAYS as readonly number[]).includes(savedDays)) {
    return { selected: savedDays as PresetDays, customInput: "" };
  }
  return { selected: "custom", customInput: String(savedDays) };
}

interface Props {
  setting: AutomationSetting | null;
  currentEnabled: boolean;
  onSaved?: () => void;
  onPreviewChange?: (template: string, offerType: string, offerValue: string) => void;
  /** Server-computed: may this user/env use minute-based test timing? */
  allowMinuteTesting?: boolean;
  /** Whether real WhatsApp sends are configured (drives the extra minute-mode confirmation). */
  realSendConfigured?: boolean;
}

export function WinBackSettingsForm({
  setting,
  currentEnabled,
  onSaved,
  onPreviewChange,
  allowMinuteTesting = false,
  realSendConfigured = false,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Test-mode (minutes) state — only meaningful when allowMinuteTesting ──
  const [timingUnit, setTimingUnit] = useState<"days" | "minutes">(
    (setting?.timingUnit as "days" | "minutes") ?? "days",
  );
  const [testThresholdInput, setTestThresholdInput] = useState(
    setting?.testThresholdMinutes != null ? String(setting.testThresholdMinutes) : "5",
  );
  const [testCooldownInput, setTestCooldownInput] = useState(
    setting?.testCooldownMinutes != null ? String(setting.testCooldownMinutes) : "1",
  );
  const [minuteConfirm, setMinuteConfirm] = useState(false);
  const [testModeError, setTestModeError] = useState("");

  // Minute mode is only ever active when the env/user allows it.
  const minuteModeActive = allowMinuteTesting && timingUnit === "minutes";
  // Extra confirmation required only when minute mode could send real messages.
  const needsMinuteConfirm = minuteModeActive && realSendConfigured;

  const initialThreshold = getInitialThresholdSelection(setting?.thresholdDays ?? 30);
  const [thresholdSelected, setThresholdSelected] = useState<PresetDays | "custom">(initialThreshold.selected);
  const [customDaysInput, setCustomDaysInput] = useState(initialThreshold.customInput);
  const [customDaysError, setCustomDaysError] = useState("");

  const [sendHour, setSendHour] = useState(setting?.sendHour ?? 12);
  const [messageTemplate, setMessageTemplate] = useState(
    setting?.messageTemplate ?? DEFAULT_WIN_BACK_TEMPLATE,
  );
  const [offerType, setOfferType] = useState<"none" | "discount_10" | "upgrade" | "special_slot" | "custom">(
    (setting?.offerType as "none") ?? "none",
  );
  const [offerValue, setOfferValue] = useState(setting?.offerValue ?? "");

  const handleTemplateChange = (val: string) => {
    setMessageTemplate(val);
    onPreviewChange?.(val, offerType, offerValue);
  };

  const handleOfferTypeChange = (val: typeof offerType) => {
    setOfferType(val);
    onPreviewChange?.(messageTemplate, val, offerValue);
  };

  const handleOfferValueChange = (val: string) => {
    setOfferValue(val);
    onPreviewChange?.(messageTemplate, offerType, val);
  };

  const getEffectiveThresholdDays = (): number | null => {
    if (thresholdSelected !== "custom") return thresholdSelected;
    const n = parseInt(customDaysInput, 10);
    if (!customDaysInput || isNaN(n) || n < 1) return null;
    return n;
  };

  const handleSave = () => {
    setError(null);
    setSaved(false);
    setCustomDaysError("");
    setTestModeError("");

    if (thresholdSelected === "custom") {
      const days = getEffectiveThresholdDays();
      if (days === null) {
        setCustomDaysError("יש להזין מספר ימים תקין");
        return;
      }
    }

    // Validate test-mode (minutes) inputs and the safety confirmation.
    let testThresholdMinutes: number | null = null;
    let testCooldownMinutes: number | null = null;
    if (minuteModeActive) {
      const t = parseInt(testThresholdInput, 10);
      const cd = parseInt(testCooldownInput, 10);
      if (isNaN(t) || t < 1 || isNaN(cd) || cd < 1) {
        setTestModeError(tm.minutesInvalidError);
        return;
      }
      if (needsMinuteConfirm && !minuteConfirm) {
        setTestModeError(tm.realSendConfirmError);
        return;
      }
      testThresholdMinutes = t;
      testCooldownMinutes = cd;
    }

    const thresholdDays = getEffectiveThresholdDays()!;

    startTransition(async () => {
      const result = await saveWinBackAutomationSetting({
        enabled: currentEnabled,
        thresholdDays,
        sendHour,
        messageTemplate: messageTemplate || null,
        offerType,
        offerValue: offerType === "custom" ? offerValue : null,
        cooldownDays: setting?.cooldownDays ?? 30,
        // Client consent (opt-in) is no longer a gate — win-back targets all
        // eligible clients except those who replied STOP.
        requireOptIn: false,
        templateName: setting?.templateName ?? null,
        templateLanguage: setting?.templateLanguage ?? "he",
        timingUnit: minuteModeActive ? "minutes" : "days",
        testThresholdMinutes,
        testCooldownMinutes,
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
    background: "linear-gradient(135deg, #c76f93 0%, #ac5c7f 100%)",
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
    <div className="space-y-5">

      {/* מתי כדאי לנסות להחזיר לקוחה */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          מתי כדאי לנסות להחזיר לקוחה?
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_DAYS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => { setThresholdSelected(days); setCustomDaysError(""); }}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
              style={thresholdSelected === days ? chipActive : chipInactive}
            >
              {days} ימים
            </button>
          ))}
          <button
            type="button"
            onClick={() => setThresholdSelected("custom")}
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
            style={thresholdSelected === "custom" ? chipActive : chipInactive}
          >
            מותאם אישית
          </button>
        </div>
        {thresholdSelected === "custom" && (
          <div className="space-y-1">
            <label className="block text-xs font-medium" style={{ color: "var(--muted)" }}>
              מספר ימים ללא תור
            </label>
            <input
              type="number"
              min={7}
              max={365}
              value={customDaysInput}
              onChange={(e) => {
                setCustomDaysInput(e.target.value);
                setCustomDaysError("");
              }}
              placeholder="לדוגמה: 45"
              style={{ ...inputStyle, maxWidth: "160px" }}
            />
            {customDaysError && (
              <p className="text-xs" style={{ color: "#dc2626" }}>
                {customDaysError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* מה יעזור ללקוחה לחזור */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          מה יעזור ללקוחה לחזור?
        </label>
        <div className="flex flex-wrap gap-2">
          {OFFER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleOfferTypeChange(opt.value)}
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
            onChange={(e) => handleOfferValueChange(e.target.value)}
            placeholder="לדוגמה: מגיעה לך הנחה של 15% 🎁"
            style={inputStyle}
          />
        )}
      </div>

      {/* Advanced settings */}
      <details className="group">
        <summary
          className="flex cursor-pointer list-none items-center gap-1.5 select-none text-xs font-medium py-1"
          style={{ color: "var(--muted)" }}
        >
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          עריכה מתקדמת
        </summary>

        <div className="mt-3 space-y-4 pt-1" style={{ borderTop: "1px solid var(--border)" }}>

          {/* Send time */}
          <div className="space-y-2">
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

          {/* Message template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                נוסח ההודעה
              </label>
              <button
                type="button"
                onClick={() => handleTemplateChange(DEFAULT_WIN_BACK_TEMPLATE)}
                className="text-xs transition-opacity hover:opacity-70"
                style={{ color: "var(--muted)" }}
              >
                איפוס
              </button>
            </div>
            <textarea
              rows={4}
              value={messageTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
              placeholder={c.templatePlaceholder}
              className="resize-none leading-relaxed"
              style={{ ...inputStyle, direction: "rtl" }}
            />
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {c.templateHelper}
            </p>
          </div>

        </div>
      </details>

      {/* מצב בדיקה — admin/dev only, hidden entirely from regular owners */}
      {allowMinuteTesting && (
        <div
          className="space-y-3 rounded-xl p-4"
          style={{
            background: "rgba(107,114,128,0.05)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 shrink-0" style={{ color: "var(--muted)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {tm.title}
            </span>
            <span className="ms-auto rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
              {tm.adminBadge}
            </span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
            {tm.description}
          </p>

          {/* Timing unit selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium" style={{ color: "var(--muted)" }}>
              {tm.unitLabel}
            </label>
            <div className="flex flex-wrap gap-2">
              {([
                { value: "days" as const, label: tm.unitDays },
                { value: "minutes" as const, label: tm.unitMinutes },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setTimingUnit(opt.value);
                    setTestModeError("");
                    if (opt.value === "days") setMinuteConfirm(false);
                  }}
                  className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
                  style={timingUnit === opt.value ? chipActive : chipInactive}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Days mode — informational: production threshold is set above */}
          {timingUnit === "days" && (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {tm.sendAfterLabel}: {getEffectiveThresholdDays() ?? "—"} {tm.daysSuffix}
            </p>
          )}

          {/* Minutes mode — test inputs + warnings */}
          {minuteModeActive && (
            <div className="space-y-3">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="space-y-1">
                  <label className="block text-xs font-medium" style={{ color: "var(--muted)" }}>
                    {tm.sendAfterLabel}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={testThresholdInput}
                      onChange={(e) => {
                        setTestThresholdInput(e.target.value);
                        setTestModeError("");
                      }}
                      style={{ ...inputStyle, maxWidth: "100px" }}
                    />
                    <span className="text-sm" style={{ color: "var(--muted)" }}>
                      {tm.minutesSuffix}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium" style={{ color: "var(--muted)" }}>
                    {tm.cooldownLabel}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={testCooldownInput}
                      onChange={(e) => {
                        setTestCooldownInput(e.target.value);
                        setTestModeError("");
                      }}
                      style={{ ...inputStyle, maxWidth: "100px" }}
                    />
                    <span className="text-sm" style={{ color: "var(--muted)" }}>
                      {tm.minutesSuffix}
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning: minutes can send very fast */}
              <div
                className="flex items-start gap-2 rounded-lg px-3 py-2"
                style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.28)" }}
              >
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "#b45309" }} />
                <p className="text-xs leading-relaxed" style={{ color: "#92400e" }}>
                  {tm.minutesWarning}
                </p>
              </div>

              {/* Active-mode banner */}
              <div
                className="rounded-lg px-3 py-2"
                style={{ background: "rgba(199,111,147,0.08)", border: "1px solid rgba(199,111,147,0.25)" }}
              >
                <p className="text-xs font-medium" style={{ color: "#8a3d60" }}>
                  {tm.activeBanner}
                </p>
              </div>

              {/* Extra confirmation — only when real sends are configured */}
              {needsMinuteConfirm && (
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={minuteConfirm}
                    onChange={(e) => {
                      setMinuteConfirm(e.target.checked);
                      setTestModeError("");
                    }}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  />
                  <span className="text-xs leading-relaxed" style={{ color: "var(--foreground)" }}>
                    {tm.realSendConfirm}
                  </span>
                </label>
              )}
            </div>
          )}

          {testModeError && (
            <p className="text-xs" style={{ color: "#dc2626" }}>
              {testModeError}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={handleSave}
        className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{
          background: saved
            ? "linear-gradient(135deg, #3d8b6e 0%, #2d7060 100%)"
            : "linear-gradient(135deg, #c76f93 0%, #ac5c7f 100%)",
        }}
      >
        {isPending ? c.saving : saved ? c.saved : c.saveButton}
      </button>
    </div>
  );
}
