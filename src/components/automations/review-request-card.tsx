"use client";

import { useState, useTransition } from "react";
import { X, Pencil, ChevronDown, CheckCircle, AlertTriangle, FlaskConical, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  toggleReviewRequestAction,
  saveReviewRequestTimingAction,
} from "@/server/review-request/actions";
import { AutomationLastRunSummary } from "@/components/automations/automation-last-run-summary";
import type { AutomationSetting } from "@prisma/client";
import type { LastRunSummary } from "@/server/automations/run-queries";

const DEFAULT_TEMPLATE =
  "היי {שם הלקוח} ❤️\n\nנהנינו לארח אותך!\n\nנשמח אם תוכלי להשאיר ביקורת קצרה 🙏\n{קישור לביקורת}\n\n{שם העסק}";

const TIMING_OPTIONS = [
  { id: "1_hour", label: "✨ מיד אחרי הביקור", hoursAfter: 1 },
  { id: "3_hours", label: "🌙 בערב של אותו יום", hoursAfter: 3 },
  { id: "1_day", label: "☀️ למחרת", hoursAfter: 24 },
] as const;

function detectTiming(setting: AutomationSetting | null): string {
  if (!setting) return "1_day";
  const h = setting.sendHour;
  if (h <= 2) return "1_hour";
  if (h <= 6) return "3_hours";
  return "1_day";
}

function buildPreview(template: string, reviewLink: string): string {
  const link = reviewLink || "beautiq.co/b/example#reviews";
  return template
    .replace(/\{שם הלקוח\}/g, "נועה")
    .replace(/\{שם הלקוחה\}/g, "נועה")
    .replace(/\{שם העסק\}/g, "הסטודיו שלי")
    .replace(/\{שירות\}/g, "טיפול פנים")
    .replace(/\{קישור לביקורת\}/g, link)
    .replace(/\{review_link\}/g, link);
}

function TemplateReadinessBadge({
  realSendConfigured,
  testMode,
  hasTemplate,
  onConfigure,
}: {
  realSendConfigured: boolean;
  testMode: boolean;
  hasTemplate: boolean;
  onConfigure?: () => void;
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
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "#b45309" }}>
        <AlertTriangle className="h-3 w-3 shrink-0" />
        חסרה תבנית הודעה
      </div>
      <p className="text-xs leading-snug" style={{ color: "var(--muted)" }}>
        האוטומציה פעילה, אבל לא תשלח הודעות אמיתיות עד שתוגדר תבנית WhatsApp מאושרת.
      </p>
      {onConfigure && (
        <button
          type="button"
          onClick={onConfigure}
          className="text-xs font-medium transition-opacity hover:opacity-70"
          style={{ color: "#c97898" }}
        >
          הגדרת תבנית
        </button>
      )}
    </div>
  );
}

interface Props {
  setting: AutomationSetting | null;
  sentThisMonth: number;
  lastRun?: LastRunSummary | null;
  realSendConfigured?: boolean;
  testMode?: boolean;
}

export function ReviewRequestCard({ setting, sentThisMonth, lastRun, realSendConfigured = false, testMode = false }: Props) {
  const [isEnabled, setIsEnabled] = useState(setting?.enabled ?? false);
  const [isToggling, startToggle] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  const [selectedTiming, setSelectedTiming] = useState(() => detectTiming(setting));
  const [messageTemplate, setMessageTemplate] = useState(
    setting?.messageTemplate ?? DEFAULT_TEMPLATE,
  );
  const [reviewLink, setReviewLink] = useState(setting?.offerValue ?? "");
  const [requireOptIn, setRequireOptIn] = useState(setting?.requireOptIn ?? false);
  const [templateName, setTemplateName] = useState(setting?.templateName ?? "");
  const [templateLanguage, setTemplateLanguage] = useState(setting?.templateLanguage ?? "he");
  const [editingMessage, setEditingMessage] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    const next = !isEnabled;
    setIsEnabled(next);
    startToggle(async () => {
      const result = await toggleReviewRequestAction(next);
      if (!result.success) setIsEnabled(!next);
    });
  };

  const handleSave = () => {
    setError(null);
    setSaved(false);
    const timing = TIMING_OPTIONS.find((t) => t.id === selectedTiming) ?? TIMING_OPTIONS[2];
    startTransition(async () => {
      const result = await saveReviewRequestTimingAction({
        hoursAfter: timing.hoursAfter,
        messageTemplate: messageTemplate || null,
        reviewLink: reviewLink || null,
        requireOptIn,
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

  const previewText = buildPreview(messageTemplate, reviewLink);
  const saveBtnText = isPending ? "שומר…" : saved ? "נשמר ✓" : "שמור";
  const saveBtnStyle = {
    background: saved
      ? "linear-gradient(135deg, #3d8b6e 0%, #2d7060 100%)"
      : "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
  };

  const previewBubble = (
    <div
      className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-loose w-full"
      style={{
        background: "#fff",
        color: "#111",
        whiteSpace: "pre-wrap",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      {previewText}
    </div>
  );

  return (
    <>
      {/* Card */}
      <div
        className="flex flex-col rounded-2xl p-4 gap-2.5"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            בקשת ביקורת
          </h3>
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggle}
            disabled={isToggling}
            aria-label="הפעלת בקשת ביקורת"
          />
        </div>

        <p className="text-xs font-semibold" style={{ color: isEnabled ? "#16a34a" : "var(--muted)" }}>
          {isEnabled ? "פעיל" : "כבוי"}
        </p>

        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          לאחר ביקור הלקוחה תקבל הודעה עם בקשה להשאיר ביקורת.
        </p>

        {sentThisMonth > 0 && (
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            נשלחו {sentThisMonth} בקשות החודש
          </p>
        )}

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
          onConfigure={() => setDialogOpen(true)}
        />

        <AutomationLastRunSummary lastRun={lastRun ?? null} />
      </div>

      {/* Dialog */}
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
                בקשת ביקורת
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
                      לקוחות מרוצות משאירות יותר ביקורות.
                    </p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>
                      המערכת תבקש ביקורת באופן אוטומטי לאחר כל תור שהושלם.
                    </p>
                  </div>

                  {/* Timing */}
                  <div>
                    <p className="text-sm font-bold mb-2.5" style={{ color: "var(--foreground)" }}>
                      מתי לשלוח?
                    </p>
                    <div className="space-y-1.5">
                      {TIMING_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedTiming(option.id)}
                          className="w-full text-right rounded-xl px-4 py-2.5 text-sm font-medium transition-all flex items-center gap-3"
                          style={
                            selectedTiming === option.id
                              ? { background: "rgba(201,120,152,0.08)", border: "2px solid #c97898", color: "var(--foreground)" }
                              : { background: "var(--background-alt)", border: "2px solid transparent", color: "var(--muted)" }
                          }
                        >
                          <span
                            className="h-4 w-4 rounded-full border-2 flex-shrink-0"
                            style={
                              selectedTiming === option.id
                                ? { borderColor: "#c97898", background: "#c97898" }
                                : { borderColor: "var(--border)", background: "transparent" }
                            }
                          />
                          {option.label}
                        </button>
                      ))}
                    </div>
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

                  {/* Advanced */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setAdvancedOpen(!advancedOpen)}
                      className="flex items-center gap-1.5 text-sm font-medium w-full transition-opacity hover:opacity-70"
                      style={{ color: "var(--muted)" }}
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
                      />
                      עריכה מתקדמת
                    </button>

                    {advancedOpen && (
                      <div className="mt-3 space-y-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
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
                                ? "בקשות ביקורת יישלחו רק ללקוחות שנתנו הסכמה מפורשת."
                                : "בקשות ביקורת יישלחו לכל הלקוחות (מומלץ לשירות עסקי)."}
                            </p>
                          </div>
                        </div>

                        <div>
                          <label
                            className="block text-sm font-semibold mb-1.5"
                            style={{ color: "var(--foreground)" }}
                          >
                            קישור לדף הביקורות
                          </label>
                          <input
                            type="url"
                            value={reviewLink}
                            onChange={(e) => setReviewLink(e.target.value)}
                            dir="ltr"
                            className="w-full rounded-xl px-4 py-2.5 text-sm"
                            style={{
                              border: "1px solid var(--border)",
                              background: "var(--background)",
                              color: "var(--foreground)",
                            }}
                            placeholder="https://g.page/my-business/review"
                          />
                          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                            גוגל ביזנס, Facebook, או כל דף ביקורות אחר
                          </p>
                        </div>

                        {/* WhatsApp template fields */}
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
                              placeholder="review_request_he"
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

                        {!editingMessage ? (
                          <button
                            type="button"
                            onClick={() => setEditingMessage(true)}
                            className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
                            style={{ color: "#c97898" }}
                          >
                            <Pencil className="h-3 w-3" />
                            עריכת נוסח ההודעה
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <label className="block text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                              נוסח ההודעה
                            </label>
                            <textarea
                              rows={5}
                              value={messageTemplate}
                              onChange={(e) => setMessageTemplate(e.target.value)}
                              className="w-full rounded-xl px-4 py-2.5 text-sm resize-none leading-relaxed"
                              style={{
                                border: "1px solid var(--border)",
                                background: "var(--background)",
                                color: "var(--foreground)",
                                direction: "rtl",
                              }}
                            />
                            <div className="flex items-center justify-between">
                              <p className="text-xs" style={{ color: "var(--muted)" }}>
                                {"{שם הלקוח}"} {"{שם העסק}"} {"{קישור לביקורת}"}
                              </p>
                              <button
                                type="button"
                                onClick={() => setMessageTemplate(DEFAULT_TEMPLATE)}
                                className="text-xs transition-opacity hover:opacity-70"
                                style={{ color: "var(--muted)" }}
                              >
                                איפוס
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {error && (
                    <p className="text-sm" style={{ color: "#dc2626" }}>
                      {error}
                    </p>
                  )}
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

            {/* Sticky save — mobile only */}
            <div
              className="sm:hidden flex-shrink-0 p-4"
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
