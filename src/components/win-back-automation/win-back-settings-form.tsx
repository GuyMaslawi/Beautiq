"use client";

import { useState, useTransition } from "react";
import { Settings2, Info, Shield, FileCheck, CheckCircle2, XCircle, List, Send, Flag, Circle } from "lucide-react";
import { WIN_BACK_AUTOMATION } from "@/lib/constants/he";
import {
  saveWinBackAutomationSetting,
  sendWhatsAppTestMessage,
  type TestSendResult,
  type TestSendErrorCode,
} from "@/server/win-back-automation/actions";
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
const cl = WIN_BACK_AUTOMATION.setupChecklist;
const ct = WIN_BACK_AUTOMATION.testSend;
const PRESET_DAYS = WIN_BACK_AUTOMATION.settings.presetDays;

function errorMessageForCode(code: TestSendErrorCode | undefined, raw?: string): string {
  switch (code) {
    case "missing_test_mode":     return ct.errorMissingTestMode;
    case "missing_real_send":     return ct.errorMissingRealSend;
    case "missing_provider":      return ct.errorMissingProvider;
    case "missing_credentials":   return ct.errorMissingCredentials;
    case "missing_test_phone":    return ct.errorMissingTestPhone;
    case "missing_template":      return ct.errorMissingTemplate;
    case "provider_error":        return raw ?? ct.errorProviderError;
    default:                      return raw ?? ct.errorGeneric;
  }
}

export interface SetupStatus {
  providerConfigured: boolean;
  credentialsConfigured: boolean;
  testPhoneConfigured: boolean;
  templateConfigured: boolean;
  testModeActive: boolean;
  realSendEnabled: boolean;
  /** True when testSendPassedAt is set — sandbox send was confirmed */
  sandboxTestPassed: boolean;
  /** True when META_WHATSAPP_PHONE_NUMBER_ID is set */
  hasRealBusinessPhone: boolean;
}

function SetupChecklist({ status }: { status: SetupStatus }) {
  const [isSending, startSendTransition] = useTransition();
  const [testResult, setTestResult] = useState<TestSendResult | null>(null);

  const items: Array<{ label: string; ok: boolean }> = [
    { label: cl.providerConfigured, ok: status.providerConfigured },
    { label: cl.credentialsConfigured, ok: status.credentialsConfigured },
    { label: cl.testPhoneConfigured, ok: status.testPhoneConfigured },
    { label: cl.templateConfigured, ok: status.templateConfigured },
    { label: cl.testModeActive, ok: status.testModeActive },
    { label: cl.realSendEnabled, ok: status.realSendEnabled },
  ];

  const milestones: Array<{ label: string; pending: string; ok: boolean }> = [
    { label: cl.sandboxTestPassed, pending: cl.sandboxTestPending, ok: status.sandboxTestPassed },
    { label: cl.hasRealBusinessPhone, pending: cl.awaitingBusinessPhone, ok: status.hasRealBusinessPhone },
    { label: cl.hebrewTemplateConfigured, pending: cl.awaitingHebrewTemplate, ok: status.templateConfigured },
    { label: cl.webhooksConfigured, pending: cl.awaitingWebhooks, ok: false },
    { label: cl.unsubscribeReady, pending: cl.awaitingUnsubscribe, ok: false },
    { label: cl.cronEnabled, pending: cl.awaitingCron, ok: false },
  ];

  const allReady = items.every((i) => i.ok);
  const canTestSend =
    status.providerConfigured &&
    status.credentialsConfigured &&
    status.testPhoneConfigured &&
    status.testModeActive &&
    status.realSendEnabled;

  const handleTestSend = () => {
    setTestResult(null);
    startSendTransition(async () => {
      const result = await sendWhatsAppTestMessage();
      setTestResult(result);
    });
  };

  return (
    <div
      className="space-y-3 rounded-xl px-4 py-4"
      style={{
        background: allReady ? "rgba(22,163,74,0.05)" : "rgba(107,114,128,0.05)",
        border: `1px solid ${allReady ? "rgba(22,163,74,0.20)" : "rgba(107,114,128,0.18)"}`,
      }}
    >
      <div className="flex items-center gap-2">
        <List className="h-3.5 w-3.5 shrink-0" style={{ color: allReady ? "#16a34a" : "var(--muted)" }} />
        <span className="text-xs font-semibold" style={{ color: allReady ? "#15803d" : "var(--foreground)" }}>
          {cl.title}
        </span>
      </div>
      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
        {cl.subtitle}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            {item.ok ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "#16a34a" }} />
            ) : (
              <XCircle className="h-3.5 w-3.5 shrink-0" style={{ color: "#9ca3af" }} />
            )}
            <span
              className="text-xs"
              style={{ color: item.ok ? "var(--foreground)" : "var(--muted)" }}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
      <p
        className="text-xs font-semibold"
        style={{ color: allReady ? "#15803d" : "#9ca3af" }}
      >
        {allReady ? cl.readyToTest : cl.notReady}
      </p>

      {/* Production readiness milestones */}
      <div
        className="mt-1 space-y-2 rounded-lg px-3 py-3"
        style={{
          background: "rgba(59,122,181,0.04)",
          border: "1px solid rgba(59,122,181,0.14)",
        }}
      >
        <div className="flex items-center gap-1.5">
          <Flag className="h-3 w-3 shrink-0" style={{ color: "#3b7ab5" }} />
          <span className="text-[11px] font-semibold" style={{ color: "#2a5a8a" }}>
            {cl.productionReadinessTitle}
          </span>
        </div>
        <ul className="space-y-1.5">
          {milestones.map((m) => (
            <li key={m.label} className="flex items-center gap-2">
              {m.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "#16a34a" }} />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0" style={{ color: "#9ca3af" }} />
              )}
              <span
                className="text-xs"
                style={{ color: m.ok ? "var(--foreground)" : "var(--muted)" }}
              >
                {m.ok ? m.label : m.pending}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Test-send button — visible when test mode essentials are ready */}
      {canTestSend && (
        <div className="space-y-1.5">
          <button
            type="button"
            disabled={isSending}
            onClick={handleTestSend}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
            }}
          >
            <Send className="h-3.5 w-3.5 shrink-0" />
            {isSending ? ct.sending : ct.buttonLabel}
          </button>
          <p className="text-center text-[11px]" style={{ color: "var(--muted)" }}>
            {cl.testSendNote}
          </p>
        </div>
      )}

      {/* Test-send result */}
      {testResult && (
        <div
          className="rounded-lg px-3 py-2.5 text-xs"
          style={{
            background: testResult.success ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.07)",
            border: `1px solid ${testResult.success ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.20)"}`,
            color: testResult.success ? "#15803d" : "#b91c1c",
          }}
        >
          {testResult.success ? (
            <div className="space-y-1">
              <p className="font-semibold">{ct.successTitle}</p>
              <p>{ct.successBody}</p>
              {testResult.providerMessageId && (
                <p dir="ltr" className="mt-1 font-mono text-[11px] opacity-80">
                  {ct.providerMessageIdLabel} {testResult.providerMessageId}
                </p>
              )}
              {testResult.sentAt && (
                <p className="text-[11px] opacity-70">
                  {new Date(testResult.sentAt).toLocaleTimeString("he-IL")}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-semibold">{ct.failureTitle}</p>
              <p>{errorMessageForCode(testResult.errorCode, testResult.error)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const OFFER_OPTIONS = [
  { value: "none" as const, label: c.offerNone },
  { value: "discount_10" as const, label: c.offerDiscount10 },
  { value: "upgrade" as const, label: c.offerUpgrade },
  { value: "special_slot" as const, label: c.offerSpecialSlot },
  { value: "custom" as const, label: c.offerCustom },
];

const SEND_TIME_PRESETS = [
  { hour: 9, label: c.sendTimeMorning },
  { hour: 12, label: c.sendTimeNoon },
  { hour: 18, label: c.sendTimeEvening },
];

interface Props {
  setting: AutomationSetting | null;
  setupStatus: SetupStatus;
}

export function WinBackSettingsForm({ setting, setupStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(setting?.enabled ?? false);
  const [thresholdDays, setThresholdDays] = useState(setting?.thresholdDays ?? 45);
  const [customThreshold, setCustomThreshold] = useState(!PRESET_DAYS.includes(setting?.thresholdDays as never) && !!setting);
  const [sendHour, setSendHour] = useState(setting?.sendHour ?? 10);
  const [customTime, setCustomTime] = useState(
    !SEND_TIME_PRESETS.some((p) => p.hour === (setting?.sendHour ?? 10)),
  );
  const [messageTemplate, setMessageTemplate] = useState(
    setting?.messageTemplate ?? DEFAULT_WIN_BACK_TEMPLATE,
  );
  const [offerType, setOfferType] = useState<
    "none" | "discount_10" | "upgrade" | "special_slot" | "custom"
  >((setting?.offerType as "none") ?? "none");
  const [offerValue, setOfferValue] = useState(setting?.offerValue ?? "");
  const [cooldownDays, setCooldownDays] = useState(setting?.cooldownDays ?? 30);
  const [requireOptIn, setRequireOptIn] = useState(setting?.requireOptIn ?? true);
  const [templateName, setTemplateName] = useState(setting?.templateName ?? "");
  const [templateLanguage, setTemplateLanguage] = useState(setting?.templateLanguage ?? "he");

  const handleSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveWinBackAutomationSetting({
        enabled,
        thresholdDays,
        sendHour,
        messageTemplate: messageTemplate || null,
        offerType,
        offerValue: offerType === "custom" ? offerValue : null,
        cooldownDays,
        requireOptIn,
        templateName: templateName.trim() || null,
        templateLanguage: templateLanguage.trim() || "he",
      });
      if (result.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(result.error ?? c.saveError);
      }
    });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings2 className="h-4 w-4" style={{ color: "var(--muted)" }} />
        <h3 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
          {c.sectionTitle}
        </h3>
      </div>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        {c.sectionSubtitle}
      </p>

      {/* Enable toggle — locked until production requirements are met */}
      {(() => {
        const cronEnabled = false; // Phase 2B — not yet implemented
        const inRealSendFlow = setupStatus.realSendEnabled || setupStatus.credentialsConfigured;
        const productionReady =
          setupStatus.hasRealBusinessPhone &&
          setupStatus.templateConfigured &&
          !setupStatus.testModeActive &&
          cronEnabled;
        const canEnableAutoSend = !inRealSendFlow || productionReady;
        return (
          <div>
            <label
              className={`flex items-center gap-3 ${canEnableAutoSend ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
            >
              <div
                className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
                style={{
                  background:
                    enabled && canEnableAutoSend
                      ? "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)"
                      : "var(--border)",
                }}
                onClick={() => canEnableAutoSend && setEnabled((v) => !v)}
              >
                <div
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow-sm"
                  style={{
                    transform:
                      enabled && canEnableAutoSend
                        ? "translateX(1.25rem)"
                        : "translateX(0.125rem)",
                  }}
                />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  {c.enableLabel}
                </p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {canEnableAutoSend ? c.enableHelper : c.enableLockedHelper}
                </p>
              </div>
            </label>
          </div>
        );
      })()}

      {/* Threshold */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {c.thresholdLabel}
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_DAYS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => { setCustomThreshold(false); setThresholdDays(days); }}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
              style={thresholdDays === days && !customThreshold ? chipActive : chipInactive}
            >
              {days} {c.thresholdUnit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomThreshold(true)}
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
            style={customThreshold ? chipActive : chipInactive}
          >
            {c.thresholdCustom}
          </button>
        </div>
        {customThreshold && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={14}
              max={365}
              value={thresholdDays}
              onChange={(e) => setThresholdDays(Number(e.target.value))}
              className="w-20 rounded-lg border text-center text-sm font-bold tabular-nums"
              style={{ ...inputStyle, width: "5rem" }}
            />
            <span className="text-sm" style={{ color: "var(--muted)" }}>
              {c.thresholdUnit}
            </span>
          </div>
        )}
      </div>

      {/* Send time */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {c.sendTimeLabel}
        </label>
        <div className="flex flex-wrap gap-2">
          {SEND_TIME_PRESETS.map((p) => (
            <button
              key={p.hour}
              type="button"
              onClick={() => { setCustomTime(false); setSendHour(p.hour); }}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
              style={sendHour === p.hour && !customTime ? chipActive : chipInactive}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomTime(true)}
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
            style={customTime ? chipActive : chipInactive}
          >
            {c.sendTimeCustom}
          </button>
        </div>
        {customTime && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={23}
              value={sendHour}
              onChange={(e) => setSendHour(Number(e.target.value))}
              className="w-20 rounded-lg border text-center text-sm font-bold tabular-nums"
              style={{ ...inputStyle, width: "5rem" }}
            />
            <span className="text-sm" style={{ color: "var(--muted)" }}>
              {c.sendTimeCustomLabel}
            </span>
          </div>
        )}
      </div>

      {/* Offer type */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {c.offerLabel}
        </label>
        <div className="flex flex-wrap gap-2">
          {OFFER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setOfferType(opt.value)}
              className="rounded-full px-3 py-1 text-xs font-medium transition-all"
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
            placeholder={c.offerCustomPlaceholder}
            style={inputStyle}
          />
        )}
      </div>

      {/* Message template */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {c.templateLabel}
          </label>
          <button
            type="button"
            onClick={() => setMessageTemplate(DEFAULT_WIN_BACK_TEMPLATE)}
            className="text-xs transition-opacity hover:opacity-70"
            style={{ color: "var(--muted)" }}
          >
            {c.templateReset}
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
      </div>

      {/* Message preview */}
      <div className="space-y-2">
        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {c.messagePreviewTitle}
        </p>
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

      {/* Cooldown */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {c.cooldownLabel}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={7}
            max={180}
            value={cooldownDays}
            onChange={(e) => setCooldownDays(Number(e.target.value))}
            style={{ ...inputStyle, width: "5rem" }}
          />
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            {c.cooldownUnit}
          </span>
        </div>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {c.cooldownHelper}
        </p>
      </div>

      {/* Opt-in */}
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={requireOptIn}
          onChange={(e) => setRequireOptIn(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-pink-500"
        />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {c.requireOptInLabel}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
            {c.requireOptInHelper}
          </p>
        </div>
      </label>

      {/* Meta template configuration */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileCheck className="h-4 w-4" style={{ color: "var(--muted)" }} />
          <h4 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {c.templateSection}
          </h4>
        </div>
        <p className="text-xs leading-5" style={{ color: "var(--muted)" }}>
          {c.templateSectionNote}
        </p>

        <div className="space-y-2">
          <label className="block text-xs font-semibold" style={{ color: "var(--foreground)" }}>
            {c.templateNameLabel}
          </label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder={c.templateNamePlaceholder}
            dir="ltr"
            style={{ ...inputStyle }}
          />
          <p className="text-[11px] leading-5" style={{ color: "var(--muted)" }}>
            {c.templateNameHelper}
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold" style={{ color: "var(--foreground)" }}>
            {c.templateLanguageLabel}
          </label>
          <div className="flex items-center gap-2">
            {(["he", "he_IL"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setTemplateLanguage(code)}
                className="rounded-full px-3 py-1 text-xs font-medium font-mono transition-all"
                style={templateLanguage === code ? chipActive : chipInactive}
              >
                {code}
              </button>
            ))}
            <input
              type="text"
              value={templateLanguage}
              onChange={(e) => setTemplateLanguage(e.target.value)}
              placeholder={c.templateLanguagePlaceholder}
              dir="ltr"
              style={{ ...inputStyle, width: "6rem" }}
            />
          </div>
          <p className="text-[11px]" style={{ color: "var(--muted)" }}>
            {c.templateLanguageHelper}
          </p>
        </div>
      </div>

      {/* Compliance note */}
      <div
        className="flex items-start gap-2 rounded-xl px-3 py-3"
        style={{
          background: "rgba(59,122,181,0.06)",
          border: "1px solid rgba(59,122,181,0.16)",
        }}
      >
        <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "#3b7ab5" }} />
        <p className="text-xs leading-5" style={{ color: "#2a5a8a" }}>
          {WIN_BACK_AUTOMATION.complianceNote}
        </p>
      </div>

      {/* Info note */}
      <div
        className="flex items-start gap-2 rounded-xl px-3 py-3"
        style={{
          background: "rgba(184,107,140,0.06)",
          border: "1px solid rgba(184,107,140,0.16)",
        }}
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "#b86b8c" }} />
        <p className="text-xs leading-5" style={{ color: "#b86b8c" }}>
          {WIN_BACK_AUTOMATION.connectionSection.devModeNote}
        </p>
      </div>

      {/* Setup checklist — shown only when real sending is configured or test mode active */}
      {(setupStatus.realSendEnabled || setupStatus.testModeActive) && (
        <SetupChecklist status={setupStatus} />
      )}

      {/* Save */}
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
