"use client";

import { useState, useTransition } from "react";
import { X, MessageCircle, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { sendManualClientWhatsAppAction } from "@/server/clients/whatsapp-actions";
import { adminSendManualClientWhatsAppAction } from "@/server/admin/client-actions";
import type { ManualSendMessageType } from "@/server/clients/whatsapp-actions";

// ---------------------------------------------------------------------------
// Phone masking helper
// ---------------------------------------------------------------------------

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  return digits.slice(0, 3) + "***" + digits.slice(-3);
}

// ---------------------------------------------------------------------------
// Message type options
// ---------------------------------------------------------------------------

interface MessageTypeOption {
  value: ManualSendMessageType;
  label: string;
  description: string;
}

// Owner sees only production-friendly message types
const OWNER_MESSAGE_TYPES: MessageTypeOption[] = [
  {
    value: "win_back",
    label: "הודעת החזרה ללקוחה",
    description: "מעודדת לקוחה שלא חזרה לקבוע תור חדש",
  },
  {
    value: "appointment_reminder",
    label: "תזכורת לתור",
    description: "תזכורת ללקוחה על תור קרוב",
  },
  {
    value: "review_request",
    label: "בקשת ביקורת",
    description: "מבקשת ביקורת לאחר ביקור",
  },
];

// Admin also sees test/diagnostic options
const ADMIN_MESSAGE_TYPES: MessageTypeOption[] = [
  {
    value: "manual_test",
    label: "הודעת בדיקה",
    description: "hello_world — בדיקת חיבור WhatsApp",
  },
  ...OWNER_MESSAGE_TYPES,
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  clientId: string;
  clientName: string;
  clientPhone: string;
  businessName: string;
  /** True when WHATSAPP_TEST_MODE=true — shown to user so they know where message goes */
  isTestMode: boolean;
  /** True when rendered inside admin UI — shows admin-specific message types */
  isAdmin?: boolean;
  /** Trigger element */
  trigger: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WhatsAppManualSendModal({
  clientId,
  clientName,
  clientPhone,
  businessName,
  isTestMode,
  isAdmin = false,
  trigger,
}: Props) {
  const typeOptions = isAdmin ? ADMIN_MESSAGE_TYPES : OWNER_MESSAGE_TYPES;
  const defaultType = isAdmin ? "manual_test" : "win_back";

  const [open, setOpen] = useState(false);
  const [messageType, setMessageType] = useState<ManualSendMessageType>(defaultType);
  const [isPending, startTransition] = useTransition();

  type Step = "confirm" | "recent_warning" | "success" | "error";
  const [step, setStep] = useState<Step>("confirm");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successIsTestMode, setSuccessIsTestMode] = useState(false);

  function handleOpen() {
    setStep("confirm");
    setMessageType(defaultType);
    setErrorMsg("");
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  function doSend(forceIfRecent?: boolean) {
    startTransition(async () => {
      const result = isAdmin
        ? await adminSendManualClientWhatsAppAction(clientId, messageType)
        : await sendManualClientWhatsAppAction(clientId, messageType, forceIfRecent);

      if (result.recentMessageWarning) {
        setStep("recent_warning");
        return;
      }

      if (result.error) {
        setErrorMsg(result.error);
        setStep("error");
        return;
      }

      setSuccessIsTestMode(result.isTestMode ?? false);
      setStep("success");
    });
  }

  const selectedOption = typeOptions.find((o) => o.value === messageType);

  return (
    <>
      <span onClick={handleOpen} style={{ display: "contents" }}>
        {trigger}
      </span>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/40"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
            <div
              className="relative w-full sm:max-w-md flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
              style={{ background: "var(--surface, #fff)", maxHeight: "90dvh" }}
            >
              {/* Header */}
              <div
                className="flex shrink-0 items-center justify-between px-5 py-4"
                style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                  <h2 className="text-base font-bold" style={{ color: "var(--foreground, #1a1a2e)" }}>
                    שליחת הודעת WhatsApp
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-full p-1.5 transition-opacity hover:opacity-70"
                  style={{ color: "var(--muted, #888)" }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-4">

                {/* ---- Confirm step ---- */}
                {step === "confirm" && (
                  <>
                    {/* Client info */}
                    <div
                      className="rounded-xl p-4 space-y-2"
                      style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.07)" }}
                    >
                      <Row label="לקוחה" value={clientName} />
                      <Row label="טלפון" value={maskPhone(clientPhone)} dir="ltr" />
                      <Row label="עסק" value={businessName} />
                      <Row label="נמען בפועל" value={isTestMode ? "מספר הבדיקה" : "הלקוחה"} />
                    </div>

                    {/* Message type selector */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold" style={{ color: "var(--foreground-soft, #555)" }}>
                        סוג הודעה
                      </label>
                      <div className="space-y-2">
                        {typeOptions.map((opt) => (
                          <label
                            key={opt.value}
                            className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors"
                            style={{
                              borderColor: messageType === opt.value ? "#16a34a" : "rgba(0,0,0,0.10)",
                              background: messageType === opt.value ? "rgba(22,163,74,0.04)" : "transparent",
                            }}
                          >
                            <input
                              type="radio"
                              name="messageType"
                              value={opt.value}
                              checked={messageType === opt.value}
                              onChange={() => setMessageType(opt.value)}
                              className="mt-0.5 h-4 w-4 cursor-pointer shrink-0"
                              style={{ accentColor: "#16a34a" }}
                            />
                            <div>
                              <p className="text-sm font-medium" style={{ color: "var(--foreground, #1a1a2e)" }}>
                                {opt.label}
                              </p>
                              <p className="text-xs mt-0.5" style={{ color: "var(--muted, #888)" }}>
                                {opt.description}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Preview of what will be sent */}
                    {selectedOption && (
                      <div
                        className="rounded-xl px-4 py-3 text-xs leading-5"
                        style={{ background: "rgba(22,163,74,0.04)", border: "1px solid rgba(22,163,74,0.18)" }}
                      >
                        <p className="font-semibold mb-0.5" style={{ color: "#15803d" }}>
                          תצוגה מקדימה
                        </p>
                        <p style={{ color: "var(--foreground-soft, #555)" }}>
                          {getMessagePreview(messageType, clientName, businessName)}
                        </p>
                      </div>
                    )}

                    {/* Test mode notice */}
                    {isTestMode && (
                      <div
                        className="rounded-xl px-4 py-3 text-xs leading-5"
                        style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)", color: "#854d0e" }}
                      >
                        <p className="font-semibold mb-0.5">מצב בדיקה פעיל</p>
                        <p>ההודעה תישלח רק למספר הבדיקה שהוגדר במערכת, ולא למספר של הלקוחה.</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-1">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                        style={{ color: "var(--muted, #888)", background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}
                      >
                        ביטול
                      </button>
                      <button
                        type="button"
                        onClick={() => doSend()}
                        disabled={isPending}
                        className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                        style={{ background: "#16a34a" }}
                      >
                        {isPending ? "שולח…" : "שליחה"}
                      </button>
                    </div>
                  </>
                )}

                {/* ---- Recent warning step ---- */}
                {step === "recent_warning" && (
                  <>
                    <div
                      className="rounded-xl px-4 py-3 flex gap-3"
                      style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)" }}
                    >
                      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-yellow-600" />
                      <div>
                        <p className="text-sm font-semibold text-yellow-800">נשלחה הודעה ללקוחה לאחרונה</p>
                        <p className="mt-1 text-xs text-yellow-700 leading-5">
                          נשלחה הודעת WhatsApp ל{clientName} בתוך ה-24 שעות האחרונות. לשלוח בכל זאת?
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                        style={{ color: "var(--muted, #888)", background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}
                      >
                        ביטול
                      </button>
                      <button
                        type="button"
                        onClick={() => doSend(true)}
                        disabled={isPending}
                        className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                        style={{ background: "#16a34a" }}
                      >
                        {isPending ? "שולח…" : "שליחה בכל זאת"}
                      </button>
                    </div>
                  </>
                )}

                {/* ---- Success step ---- */}
                {step === "success" && (
                  <>
                    <div className="flex flex-col items-center gap-3 py-4 text-center">
                      <CheckCircle className="h-10 w-10 text-green-500" />
                      <p className="text-base font-bold" style={{ color: "var(--foreground, #1a1a2e)" }}>
                        {successIsTestMode ? "ההודעה נשלחה למספר הבדיקה" : "ההודעה נשלחה"}
                      </p>
                      {successIsTestMode && (
                        <p className="text-xs" style={{ color: "var(--muted, #888)" }}>
                          מצב בדיקה פעיל — ההודעה הגיעה למספר הבדיקה בלבד
                        </p>
                      )}
                    </div>
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-lg px-6 py-2 text-sm font-semibold text-white"
                        style={{ background: "#16a34a" }}
                      >
                        סגירה
                      </button>
                    </div>
                  </>
                )}

                {/* ---- Error step ---- */}
                {step === "error" && (
                  <>
                    <div className="flex flex-col items-center gap-3 py-4 text-center">
                      <XCircle className="h-10 w-10 text-red-500" />
                      <p className="text-base font-bold text-red-700">לא נשלחה הודעה</p>
                      <p className="text-sm" style={{ color: "var(--muted, #888)" }}>{errorMsg}</p>
                    </div>
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-lg px-6 py-2 text-sm font-medium"
                        style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)", color: "var(--foreground, #1a1a2e)" }}
                      >
                        סגירה
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Message preview (client-side, not the actual sent text)
// ---------------------------------------------------------------------------

function getMessagePreview(type: ManualSendMessageType, clientName: string, businessName: string): string {
  switch (type) {
    case "win_back":
      return `היי ${clientName}, מתגעגעים אליך ב${businessName}! 💛\nכבר הגיע הזמן לטיפול חדש — נשמח לראותך שוב.`;
    case "appointment_reminder":
      return `בוקר טוב ${clientName} ☀️\nרק תזכורת קטנה שיש לך תור ב${businessName}.\nמחכות לראותך! ❤️`;
    case "review_request":
      return `היי ${clientName} ❤️\nנהנינו לארח אותך ב${businessName}!\nנשמח אם תוכלי להשאיר ביקורת קצרה 🙏`;
    case "manual_test":
      return `היי ${clientName}, זוהי הודעת בדיקה מ${businessName} 👋`;
  }
}

// ---------------------------------------------------------------------------
// Small helper component
// ---------------------------------------------------------------------------

function Row({ label, value, dir }: { label: string; value: string; dir?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span style={{ color: "var(--muted, #888)" }}>{label}</span>
      <span className="font-medium" dir={dir} style={{ color: "var(--foreground, #1a1a2e)" }}>
        {value}
      </span>
    </div>
  );
}
