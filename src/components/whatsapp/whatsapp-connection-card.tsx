"use client";

/**
 * Owner-facing WhatsApp connection card.
 *
 * Drives Meta Embedded Signup from a single button ("חיבור WhatsApp Business")
 * and shows owner-friendly states. The owner never sees tokens, WABA ids, or
 * phone number ids — only their own display phone and plain-Hebrew statuses.
 *
 * Embedded Signup requires (client-side, public) NEXT_PUBLIC_META_APP_ID and
 * NEXT_PUBLIC_META_CONFIG_ID. When those are absent the connect button is
 * disabled with a friendly note (admins configure them server-side).
 */

import { useEffect, useRef, useState, useTransition } from "react";
import Script from "next/script";
import { MessageCircle, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import {
  completeEmbeddedSignupAction,
  disconnectWhatsAppAction,
} from "@/server/whatsapp/embedded-signup-actions";
import {
  createDefaultTemplatesAction,
  syncTemplatesAction,
} from "@/server/whatsapp/templates-actions";
import type { TemplateSetupResult } from "@/server/whatsapp/templates-core";
import type { OwnerWhatsAppStatus } from "@/server/whatsapp/owner-status";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

interface Props {
  status: OwnerWhatsAppStatus;
  appId?: string;
  configId?: string;
  graphVersion: string;
  /** Admin sees technical template names; owners do not. */
  isAdmin?: boolean;
}

/**
 * Client-side Embedded Signup step tracker. Surfaced to admins in a small debug
 * panel and logged to the browser console so we can see exactly where the
 * client→server handoff stops. NEVER carries tokens/secrets — only step names.
 */
type DebugStep =
  | "idle"
  | "sdk_loaded"
  | "popup_opened"
  | "callback_received"
  | "missing_code"
  | "missing_whatsapp_ids"
  | "calling_server_action"
  | "server_action_success"
  | "server_action_failed";

const LOG = "[WA Embedded Signup]";

const PILL: Record<
  OwnerWhatsAppStatus["connection"]["state"],
  { bg: string; border: string; color: string }
> = {
  not_connected: { bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.25)", color: "#6b7280" },
  pending: { bg: "rgba(234,179,8,0.10)", border: "rgba(234,179,8,0.30)", color: "#b45309" },
  active: { bg: "rgba(22,163,74,0.08)", border: "rgba(22,163,74,0.25)", color: "#15803d" },
  error: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)", color: "#dc2626" },
};

function ownerLabelColor(label: string): string {
  if (label === "מוכן לשליחה") return "#15803d";
  if (label === "נדחתה — פני לתמיכה") return "#dc2626";
  if (label === "WhatsApp לא מחובר") return "#6b7280";
  return "#b45309"; // pending / preparing
}

export function WhatsAppConnectionCard({
  status,
  appId,
  configId,
  graphVersion,
  isAdmin = false,
}: Props) {
  const embeddedSignupEnabled = !!appId && !!configId;
  const sdkReady = useRef(false);
  // Session info (waba_id, phone_number_id) captured from the Embedded Signup popup.
  const sessionInfo = useRef<{ wabaId?: string; phoneNumberId?: string }>({});

  const [pending, startTransition] = useTransition();
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [templateResult, setTemplateResult] = useState<TemplateSetupResult | null>(null);
  const [debugStep, setDebugStep] = useState<DebugStep>("idle");
  const [sdkLoaded, setSdkLoaded] = useState(false);

  // Record + log a client-side step in one place (never logs tokens).
  function track(step: DebugStep, extra?: Record<string, unknown>) {
    setDebugStep(step);
    if (extra) console.log(`${LOG} step=${step}`, extra);
    else console.log(`${LOG} step=${step}`);
  }

  const state = status.connection.state;
  const pill = PILL[state];

  // Capture session info messages from the Meta popup.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (typeof event.origin !== "string" || !event.origin.endsWith("facebook.com")) return;
      try {
        const data = JSON.parse(event.data);
        if (data?.type === "WA_EMBEDDED_SIGNUP") {
          // Log the event + which id keys arrived (never the values).
          console.log(`${LOG} postMessage event=${data?.event}`, {
            hasData: !!data?.data,
            hasWabaId: !!data?.data?.waba_id,
            hasPhoneNumberId: !!data?.data?.phone_number_id,
          });
          if (data?.event === "FINISH" && data?.data) {
            sessionInfo.current = {
              wabaId: data.data.waba_id,
              phoneNumberId: data.data.phone_number_id,
            };
          }
        }
      } catch {
        /* non-JSON messages are ignored */
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function initFbSdk() {
    if (!appId) {
      console.warn(`${LOG} SDK loaded but NEXT_PUBLIC_META_APP_ID is missing — cannot init.`);
      return;
    }
    if (window.FB) {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: true, version: graphVersion });
      sdkReady.current = true;
      setSdkLoaded(true);
      track("sdk_loaded", { graphVersion, hasConfigId: !!configId });
    }
  }

  function handleConnect() {
    console.log(`${LOG} connect button clicked`);
    // Clear any stale red error immediately so a new attempt starts clean
    // (the old "לא הצלחנו לחבר" must not linger behind the popup).
    setMessage(null);

    if (!embeddedSignupEnabled || !window.FB) {
      console.warn(`${LOG} cannot start`, {
        embeddedSignupEnabled,
        fbLoaded: !!window.FB,
        sdkReady: sdkReady.current,
      });
      setMessage({ ok: false, text: "חיבור WhatsApp עדיין לא זמין. נסי שוב מאוחר יותר." });
      return;
    }

    sessionInfo.current = {};
    setConnecting(true);
    track("popup_opened");
    console.log(`${LOG} FB.login called`, {
      hasConfigId: !!configId,
      responseType: "code",
      overrideDefaultResponseType: true,
    });

    window.FB.login(
      (response: any) => {
        track("callback_received", {
          // keys only — never the token/code values themselves
          responseKeys: response ? Object.keys(response) : [],
          status: response?.status,
          hasAuthResponse: !!response?.authResponse,
          authResponseKeys: response?.authResponse ? Object.keys(response.authResponse) : [],
          hasCode: !!response?.authResponse?.code,
        });

        const code = response?.authResponse?.code as string | undefined;
        if (!code) {
          track("missing_code", { status: response?.status });
          setConnecting(false);
          // Covers both "popup closed/cancelled" and "Meta returned no code".
          setMessage({ ok: false, text: "לא התקבל אישור חיבור מ־Meta. נסו שוב." });
          return;
        }

        const { wabaId, phoneNumberId } = sessionInfo.current;
        // The server can resolve the phone number from the WABA, so only the
        // WABA id is strictly required client-side. If it's missing, the owner
        // never actually selected a WhatsApp Business account in the popup.
        if (!wabaId) {
          track("missing_whatsapp_ids", { hasWabaId: false, hasPhoneNumberId: !!phoneNumberId });
          setConnecting(false);
          setMessage({ ok: false, text: "לא נבחר מספר WhatsApp Business." });
          return;
        }

        track("calling_server_action", { hasWabaId: true, hasPhoneNumberId: !!phoneNumberId });
        startTransition(async () => {
          try {
            const result = await completeEmbeddedSignupAction({
              code,
              wabaId,
              phoneNumberId,
            });
            track(result.success ? "server_action_success" : "server_action_failed", {
              success: result.success,
            });
            setConnecting(false);
            setMessage({ ok: result.success, text: result.statusLabel });
          } catch (err) {
            console.error(`${LOG} server action threw`, err);
            track("server_action_failed");
            setConnecting(false);
            setMessage({ ok: false, text: "אירעה שגיאה בחיבור. נסו שוב." });
          }
        });
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      },
    );
  }

  function handleDisconnect() {
    if (!confirm("לנתק את חיבור ה-WhatsApp של העסק?")) return;
    startTransition(async () => {
      await disconnectWhatsAppAction();
      setMessage(null);
      setTemplateResult(null);
    });
  }

  function handleCreateTemplates() {
    setTemplateResult(null);
    startTransition(async () => {
      const result = await createDefaultTemplatesAction();
      setTemplateResult(result);
    });
  }

  function handleSyncTemplates() {
    setTemplateResult(null);
    startTransition(async () => {
      const result = await syncTemplatesAction();
      setTemplateResult(result);
    });
  }

  const busy = pending || connecting;

  return (
    <div
      dir="rtl"
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {embeddedSignupEnabled && (
        <Script
          src="https://connect.facebook.net/en_US/sdk.js"
          strategy="afterInteractive"
          onLoad={initFbSdk}
        />
      )}

      {/* Header + status pill */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
            style={{ background: "rgba(37,211,102,0.12)" }}
          >
            <MessageCircle className="h-4.5 w-4.5" style={{ color: "#25d366" }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              חיבור WhatsApp Business
            </h3>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              חברי את מספר ה-WhatsApp העסקי כדי לשלוח הודעות ללקוחות אוטומטית.
            </p>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: pill.bg, border: `1px solid ${pill.border}`, color: pill.color }}
        >
          {status.connection.statusLabel}
        </span>
      </div>

      {/* Connected — show display phone */}
      {state === "active" && status.connection.displayPhoneNumber && (
        <div className="flex items-center gap-2 text-xs" style={{ color: "#15803d" }}>
          <CheckCircle2 className="h-4 w-4" />
          <span>מחובר למספר {status.connection.displayPhoneNumber}</span>
        </div>
      )}

      {/* Error reason — owner-friendly, admin sees the detail */}
      {state === "error" && (
        <div className="flex items-start gap-2 text-xs" style={{ color: "#dc2626" }}>
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            לא הצלחנו להשלים את החיבור. נסי שוב, ואם הבעיה נמשכת פני לתמיכה.
            {isAdmin && status.connection.reason ? (
              <span className="block opacity-70 mt-0.5">({status.connection.reason})</span>
            ) : null}
          </span>
        </div>
      )}

      {/* First-time onboarding — calm setup steps, shown before any connection exists */}
      {state === "not_connected" && (
        <div
          className="space-y-3 rounded-xl px-4 py-3.5"
          style={{ background: "rgba(184,107,140,0.05)", border: "1px solid rgba(184,107,140,0.14)" }}
        >
          <p className="text-xs leading-relaxed" style={{ color: "var(--foreground)" }}>
            כדי לשלוח הודעות אוטומטיות ללקוחות, צריך לחבר את WhatsApp Business של העסק.
          </p>
          <ol className="space-y-2">
            {["חיבור WhatsApp", "הכנת תבניות הודעה", "הפעלת אוטומציות"].map((step, i) => (
              <li key={step} className="flex items-center gap-2.5 text-xs" style={{ color: "var(--foreground)" }}>
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold shrink-0"
                  style={{ background: "rgba(184,107,140,0.12)", color: "#b86b8c" }}
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2.5">
        {(state === "not_connected" || state === "error") && (
          <button
            onClick={handleConnect}
            disabled={busy || !embeddedSignupEnabled}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: "#25d366", color: "#fff" }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            {state === "error" ? "נסי לחבר שוב" : "חיבור WhatsApp Business"}
          </button>
        )}

        {state === "pending" && (
          <button
            onClick={handleConnect}
            disabled={busy || !embeddedSignupEnabled}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: "rgba(234,179,8,0.12)", color: "#b45309", border: "1px solid rgba(234,179,8,0.30)" }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            המשך חיבור
          </button>
        )}

        {state === "active" && (
          <button
            onClick={handleDisconnect}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: "rgba(239,68,68,0.06)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.20)" }}
          >
            ניתוק WhatsApp
          </button>
        )}
      </div>

      {(state === "not_connected" || state === "error") && (
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          החיבור מתבצע דרך Meta בצורה מאובטחת. אנחנו לא מציגים ללקוחות פרטים טכניים.
        </p>
      )}

      {!embeddedSignupEnabled && (state === "not_connected" || state === "error") && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          חיבור WhatsApp עדיין לא זמין בעסק הזה. צרי קשר עם התמיכה כדי להפעיל אותו.
        </p>
      )}

      {/* Inline message */}
      {message && (
        <div
          className="rounded-xl px-3.5 py-2.5 text-sm"
          style={{
            background: message.ok ? "rgba(22,163,74,0.07)" : "rgba(239,68,68,0.07)",
            border: `1px solid ${message.ok ? "rgba(22,163,74,0.22)" : "rgba(239,68,68,0.22)"}`,
            color: message.ok ? "#15803d" : "#dc2626",
          }}
        >
          {message.text}
        </div>
      )}

      {/* Template setup — only when connected */}
      {state === "active" && (
        <div className="space-y-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="pt-3">
            <h4 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              תבניות הודעות
            </h4>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              התבניות מוכנות אוטומטית אחרי החיבור. WhatsApp צריך לאשר אותן — זה יכול לקחת זמן קצר.
            </p>
          </div>

          {/* Per-automation readiness */}
          <ul className="space-y-1.5">
            {status.automations.map((a) => (
              <li key={a.type} className="flex items-center justify-between gap-2 text-xs">
                <span style={{ color: "var(--foreground)" }}>
                  {a.label}
                  {isAdmin && a.templateName ? (
                    <span style={{ color: "var(--muted)" }}> · {a.templateName}</span>
                  ) : null}
                </span>
                <span className="font-semibold" style={{ color: ownerLabelColor(a.ownerLabel) }}>
                  {a.ownerLabel}
                </span>
              </li>
            ))}
          </ul>

          {/* Owner: a single retry button (templates already auto-prepare on connect). */}
          {/* Admin: also gets an explicit sync button + per-template diagnostics below. */}
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleCreateTemplates}
              disabled={busy}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ background: "#b86b8c", color: "#fff" }}
            >
              {busy ? "פועל..." : "הכנת תבניות WhatsApp"}
            </button>
            {isAdmin && (
              <button
                onClick={handleSyncTemplates}
                disabled={busy}
                className="rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
                style={{ background: "rgba(184,107,140,0.10)", color: "#b86b8c", border: "1px solid rgba(184,107,140,0.25)" }}
              >
                סנכרון תבניות
              </button>
            )}
          </div>

          {templateResult && (
            <div
              className="rounded-xl px-3.5 py-2.5 text-sm space-y-1.5"
              style={{
                background: templateResult.success ? "rgba(22,163,74,0.07)" : "rgba(234,179,8,0.08)",
                border: `1px solid ${templateResult.success ? "rgba(22,163,74,0.22)" : "rgba(234,179,8,0.28)"}`,
                color: templateResult.success ? "#15803d" : "#92400e",
              }}
            >
              <p className="font-semibold">{templateResult.statusLabel}</p>
              {isAdmin && templateResult.items.length > 0 && (
                <ul className="space-y-0.5 text-xs opacity-80">
                  {templateResult.items.map((it) => (
                    <li key={it.name}>
                      {it.label} — {it.status}
                      {it.error ? ` (${it.error})` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* TEMP admin-only debug panel — last client-side Embedded Signup step.
          Remove once the client→server handoff is confirmed in production. */}
      {isAdmin && (
        <div
          className="rounded-xl px-3.5 py-2.5 text-xs space-y-1"
          style={{ background: "rgba(107,114,128,0.06)", border: "1px dashed rgba(107,114,128,0.3)", color: "var(--muted)" }}
        >
          <p className="font-semibold" style={{ color: "var(--foreground)" }}>
            דיבאג (אדמין בלבד)
          </p>
          <p>
            שלב נוכחי: <span style={{ fontFamily: "monospace" }}>{debugStep}</span>
          </p>
          <p className="opacity-80">
            SDK: {sdkLoaded ? "loaded" : "not loaded"} · appId: {appId ? "set" : "missing"} ·
            {" "}configId: {configId ? "set" : "missing"}
          </p>
        </div>
      )}
    </div>
  );
}
