"use client";

/**
 * Owner-facing WhatsApp connection card.
 *
 * Drives Meta Embedded Signup and shows owner-friendly states. The owner never
 * sees tokens, WABA ids, or phone number ids — only their own display phone and
 * plain-Hebrew statuses.
 *
 * PRE-CONNECTION CHOICE (existing-number / coexistence support): most beauty
 * business owners in Israel already use the WhatsApp Business App. Before we open
 * Meta we ask which kind of number they want to connect:
 *   A. existing WhatsApp Business App number  → try to connect it (coexistence)
 *   B. personal/regular WhatsApp number       → discouraged, with a warning gate
 *   C. a brand-new business number            → the technically simplest path
 * The chosen track is owner guidance + is stored as the connection source. The
 * actual Embedded Signup launch is the same supported FB.login flow; whether
 * coexistence is offered depends on the Meta configuration and the account's
 * eligibility (see docs/whatsapp-existing-number-coexistence.md).
 *
 * POST-COMPLETION REFRESH: the popup result is delivered through the FB.login
 * callback (no separate callback page). After the owner finishes we verify with a
 * server-scoped status read + router.refresh() so the card flips with no manual
 * refresh. We also poll as a fallback and listen for the SDK's CANCEL event.
 *
 * NUMBER CONFIRMATION: a guided-flow connection starts UNCONFIRMED. Real sends
 * stay blocked (server resolver) until the owner confirms the connected number,
 * which also surfaces a warning if the number looks like a Meta +1 555 test number.
 *
 * Embedded Signup requires (client-side, public) NEXT_PUBLIC_META_APP_ID and
 * NEXT_PUBLIC_META_CONFIG_ID. When those are absent the connect button is
 * disabled with a friendly note (admins configure them server-side).
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { MessageCircle, CheckCircle2, AlertCircle, Loader2, X, ShieldCheck } from "lucide-react";
import {
  completeEmbeddedSignupAction,
  disconnectWhatsAppAction,
  confirmConnectedNumberAction,
} from "@/server/whatsapp/embedded-signup-actions";
import { getWhatsAppConnectionStatusAction } from "@/server/whatsapp/connection-status-actions";
import {
  createDefaultTemplatesAction,
  syncTemplatesAction,
} from "@/server/whatsapp/templates-actions";
import type { TemplateSetupResult } from "@/server/whatsapp/templates-core";
import type { OwnerWhatsAppStatus } from "@/server/whatsapp/owner-status";
import {
  CONNECTION_TRACKS,
  getTrackInfo,
  connectionSourceLabel,
  looksLikeMetaTestNumber,
  classifyMetaConnectError,
  type ConnectionTrack,
} from "@/lib/whatsapp/connection-tracks";

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
  | "chooser_opened"
  | "popup_opened"
  | "callback_received"
  | "missing_code"
  | "missing_whatsapp_ids"
  | "popup_error"
  | "calling_server_action"
  | "checking_status"
  | "server_action_success"
  | "server_action_failed";

/**
 * Transient client-side flow phase that overlays the server-provided status
 * while the owner is actively connecting. When "idle", the card is driven
 * entirely by the server `status` prop (the source of truth).
 */
type FlowPhase = "idle" | "opening" | "waiting" | "checking" | "cancelled";

const LOG = "[WA Embedded Signup]";

// Polling cadence for the post-popup status check (robustness fallback).
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_MS = 45000;

const FLOW_LABEL: Record<Exclude<FlowPhase, "idle">, string> = {
  opening: "פותחים את חלון Meta...",
  waiting: "ממתינים לסיום החיבור ב־Meta...",
  checking: "בודקים את החיבור מול Meta...",
  cancelled: "החיבור לא הושלם",
};

const PILL: Record<
  OwnerWhatsAppStatus["connection"]["state"],
  { bg: string; border: string; color: string }
> = {
  not_connected: { bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.25)", color: "#6b7280" },
  pending: { bg: "rgba(234,179,8,0.10)", border: "rgba(234,179,8,0.30)", color: "#b45309" },
  active: { bg: "rgba(22,163,74,0.08)", border: "rgba(22,163,74,0.25)", color: "#15803d" },
  error: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)", color: "#dc2626" },
};

// Neutral "in progress" pill used while a transient flow phase is active.
const BUSY_PILL = { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.25)", color: "#2563eb" };

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
  const router = useRouter();
  const embeddedSignupEnabled = !!appId && !!configId;
  const sdkReady = useRef(false);
  // Session info (waba_id, phone_number_id) captured from the Embedded Signup popup.
  const sessionInfo = useRef<{ wabaId?: string; phoneNumberId?: string }>({});
  // Any error_message surfaced by the popup during this attempt (never a secret).
  const popupError = useRef<string | null>(null);

  const [pending, startTransition] = useTransition();
  const [flowPhase, setFlowPhase] = useState<FlowPhase>("idle");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Template preparation result surfaced separately from the connection itself.
  const [templateNotice, setTemplateNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [templateResult, setTemplateResult] = useState<TemplateSetupResult | null>(null);
  const [debugStep, setDebugStep] = useState<DebugStep>("idle");
  const [sdkLoaded, setSdkLoaded] = useState(false);

  // Pre-connection chooser state.
  const [chooserOpen, setChooserOpen] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<ConnectionTrack | null>(null);
  const [personalAck, setPersonalAck] = useState(false);

  // Already-registered / generic Meta error modal. Carries owner-safe content;
  // the raw detail is admin-only.
  const [connectError, setConnectError] = useState<
    { kind: "already_registered" | "generic"; raw?: string } | null
  >(null);

  // Keep the latest flow phase readable inside async callbacks/effects without
  // re-creating them on every render.
  const flowPhaseRef = useRef<FlowPhase>("idle");
  useEffect(() => {
    flowPhaseRef.current = flowPhase;
  }, [flowPhase]);

  // Poll lifecycle control — lets us cancel an in-flight poll on unmount/retry.
  const pollActive = useRef(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Record + log a client-side step in one place (never logs tokens).
  const track = useCallback((step: DebugStep, extra?: Record<string, unknown>) => {
    setDebugStep(step);
    if (extra) console.log(`${LOG} step=${step}`, extra);
    else console.log(`${LOG} step=${step}`);
  }, []);

  const state = status.connection.state;
  const needsNumberConfirmation = !!status.connection.needsNumberConfirmation;
  const displayPhoneNumber = status.connection.displayPhoneNumber;
  const isTestLookingNumber = looksLikeMetaTestNumber(displayPhoneNumber);
  // The server status is the source of truth. Once it resolves to a terminal
  // state (active/error), the transient "checking" overlay is dropped
  // automatically — so the card flips to the real state with no manual refresh.
  const serverResolved = state === "active" || state === "error";
  const isTransient =
    flowPhase === "opening" ||
    flowPhase === "waiting" ||
    (flowPhase === "checking" && !serverResolved);

  const stopPolling = useCallback(() => {
    pollActive.current = false;
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  // Cancel any in-flight poll when the card unmounts.
  useEffect(() => stopPolling, [stopPolling]);

  /**
   * Poll the server-scoped status until the connection resolves (active/error)
   * or we time out. On resolution we router.refresh() so the server component
   * re-renders the card with the live status. We never trust the popup itself
   * as proof of connection — only this server read.
   */
  const pollUntilResolved = useCallback(() => {
    stopPolling();
    pollActive.current = true;
    const startedAt = Date.now();

    const tick = async () => {
      if (!pollActive.current) return;
      try {
        const s = await getWhatsAppConnectionStatusAction();
        if (!pollActive.current) return;
        if (s.state === "active" || s.state === "error") {
          stopPolling();
          // Resolved — drop the transient overlay and pull the fresh status
          // into the server-rendered card (no manual refresh needed).
          setFlowPhase("idle");
          router.refresh();
          return;
        }
      } catch {
        // Ignore transient read errors and keep polling until timeout.
      }
      if (!pollActive.current) return;
      if (Date.now() - startedAt >= POLL_MAX_MS) {
        stopPolling();
        // Still pending after the window — leave a calm "still checking" note
        // and refresh so any later server update is reflected.
        if (flowPhaseRef.current === "checking") setFlowPhase("idle");
        setMessage({
          ok: false,
          text: "החיבור עדיין מתעדכן מול Meta. רעננו את העמוד עוד רגע כדי לראות את הסטטוס.",
        });
        router.refresh();
        return;
      }
      pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
    };

    void tick();
  }, [router, stopPolling]);

  // Capture session info + lifecycle events from the Meta popup.
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
            hasError: !!(data?.data?.error_message || data?.error_message),
          });
          // Popup is open and active — move to the "waiting for completion" copy.
          if (flowPhaseRef.current === "opening") setFlowPhase("waiting");

          // Some SDK versions surface a recoverable error (e.g. number already
          // registered) through the session info channel. Capture the message so
          // we can explain it after the popup closes without a code.
          const errMsg: string | undefined =
            data?.data?.error_message ?? data?.error_message;
          if (errMsg) popupError.current = String(errMsg);

          if (data?.event === "FINISH" && data?.data) {
            sessionInfo.current = {
              wabaId: data.data.waba_id,
              phoneNumberId: data.data.phone_number_id,
            };
          } else if (data?.event === "CANCEL") {
            // Owner backed out of the Meta flow — show a clear, non-error state.
            // postMessage alone is only a UX trigger, never proof of (dis)connection.
            stopPolling();
            setFlowPhase("cancelled");
            setMessage(null);
          }
        }
      } catch {
        /* non-JSON messages are ignored */
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [stopPolling]);

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

  /** Open the pre-connection chooser (does NOT launch Meta yet). */
  function openChooser() {
    setMessage(null);
    setTemplateNotice(null);
    setConnectError(null);
    setSelectedTrack(null);
    setPersonalAck(false);
    setChooserOpen(true);
    track("chooser_opened");
  }

  /** Launch Embedded Signup for the chosen track. */
  function startConnect(chosen: ConnectionTrack) {
    console.log(`${LOG} connect launched`, { track: chosen });
    // Clear any stale messages/notices immediately so a new attempt starts clean.
    setMessage(null);
    setTemplateNotice(null);
    setConnectError(null);
    setChooserOpen(false);
    stopPolling();
    popupError.current = null;

    if (!embeddedSignupEnabled || !window.FB) {
      console.warn(`${LOG} cannot start`, {
        embeddedSignupEnabled,
        fbLoaded: !!window.FB,
        sdkReady: sdkReady.current,
      });
      setFlowPhase("idle");
      setMessage({ ok: false, text: "חיבור WhatsApp עדיין לא זמין. נסי שוב מאוחר יותר." });
      return;
    }

    sessionInfo.current = {};
    setFlowPhase("opening");
    track("popup_opened", { track: chosen });
    console.log(`${LOG} FB.login called`, {
      hasConfigId: !!configId,
      responseType: "code",
      overrideDefaultResponseType: true,
      track: chosen,
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
          stopPolling();
          // If the popup surfaced an error (e.g. number already registered) show
          // a helpful, owner-safe explanation instead of a bare "not completed".
          if (popupError.current) {
            track("popup_error");
            const kind = classifyMetaConnectError(popupError.current);
            setFlowPhase("idle");
            setConnectError({ kind, raw: popupError.current });
            return;
          }
          track("missing_code", { status: response?.status });
          // Covers "popup closed/cancelled" and "Meta returned no code" — a
          // clear "not completed" state, not a hard error.
          setFlowPhase("cancelled");
          setMessage(null);
          return;
        }

        const { wabaId, phoneNumberId } = sessionInfo.current;
        // The server can resolve the phone number from the WABA, so only the
        // WABA id is strictly required client-side. If it's missing, the owner
        // never actually selected a WhatsApp Business account in the popup.
        if (!wabaId) {
          track("missing_whatsapp_ids", { hasWabaId: false, hasPhoneNumberId: !!phoneNumberId });
          stopPolling();
          if (popupError.current) {
            const kind = classifyMetaConnectError(popupError.current);
            setFlowPhase("idle");
            setConnectError({ kind, raw: popupError.current });
            return;
          }
          setFlowPhase("cancelled");
          setMessage({ ok: false, text: "לא נבחר מספר WhatsApp Business." });
          return;
        }

        track("calling_server_action", { hasWabaId: true, hasPhoneNumberId: !!phoneNumberId });
        setFlowPhase("checking");
        track("checking_status");
        startTransition(async () => {
          try {
            const result = await completeEmbeddedSignupAction({
              code,
              wabaId,
              phoneNumberId,
              intent: chosen,
            });
            track(result.success ? "server_action_success" : "server_action_failed", {
              success: result.success,
              templatesPrepared: result.templatesPrepared,
            });

            if (result.success) {
              // Connection succeeded. Surface template preparation separately so
              // a template failure never looks like a connection failure.
              setMessage({ ok: true, text: "WhatsApp מחובר" });
              if (result.templatesPrepared === false) {
                setTemplateNotice({
                  ok: false,
                  text:
                    "WhatsApp מחובר, אך יצירת התבניות נכשלה" +
                    (isAdmin && result.templateError ? ` (${result.templateError})` : ""),
                });
              }
              // Refetch the live server status + re-render the card; poll as a
              // fallback until the state flips to active/error.
              router.refresh();
              pollUntilResolved();
            } else {
              stopPolling();
              setFlowPhase("idle");
              setMessage({ ok: false, text: result.statusLabel });
              router.refresh();
            }
          } catch (err) {
            console.error(`${LOG} server action threw`, err);
            track("server_action_failed");
            stopPolling();
            setFlowPhase("idle");
            setMessage({ ok: false, text: "אירעה שגיאה בחיבור. נסו שוב." });
            router.refresh();
          }
        });
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        // The same supported Embedded Signup payload for every track. Whether an
        // existing WhatsApp Business App number can be connected (coexistence) is
        // governed by the Meta configuration + account eligibility, not by a
        // runtime flag here — see docs/whatsapp-existing-number-coexistence.md.
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      },
    );
  }

  function handleDisconnect() {
    if (!confirm("לנתק את חיבור ה-WhatsApp של העסק?")) return;
    stopPolling();
    startTransition(async () => {
      await disconnectWhatsAppAction();
      setFlowPhase("idle");
      setMessage(null);
      setTemplateNotice(null);
      setTemplateResult(null);
      router.refresh();
    });
  }

  function handleConfirmNumber() {
    startTransition(async () => {
      await confirmConnectedNumberAction();
      setMessage({ ok: true, text: "המספר אושר. אפשר להתחיל לשלוח הודעות ללקוחות." });
      router.refresh();
    });
  }

  function handleCreateTemplates() {
    setTemplateResult(null);
    setTemplateNotice(null);
    startTransition(async () => {
      const result = await createDefaultTemplatesAction();
      setTemplateResult(result);
      router.refresh();
    });
  }

  function handleSyncTemplates() {
    setTemplateResult(null);
    startTransition(async () => {
      const result = await syncTemplatesAction();
      setTemplateResult(result);
      router.refresh();
    });
  }

  /** Admin: retry creating a single template by name ("נסה ליצור שוב"). */
  function handleRetryTemplate(name: string) {
    startTransition(async () => {
      const result = await createDefaultTemplatesAction(name);
      // Merge the single-template outcome back into the current result table.
      setTemplateResult((prev) => {
        const updated = result.items[0];
        if (!prev || !updated) return result;
        return {
          ...prev,
          items: prev.items.map((it) => (it.name === updated.name ? updated : it)),
        };
      });
      router.refresh();
    });
  }

  const busy = pending || isTransient;

  // The pill reflects the transient flow phase while connecting; otherwise it
  // mirrors the live server status.
  const pill = isTransient ? BUSY_PILL : PILL[state];
  const pillLabel = isTransient ? FLOW_LABEL[flowPhase as Exclude<FlowPhase, "idle">] : status.connection.statusLabel;

  // Continue button gating in the chooser: personal track needs acknowledgement.
  const canContinue =
    selectedTrack !== null && (selectedTrack !== "personal" || personalAck);

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
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: pill.bg, border: `1px solid ${pill.border}`, color: pill.color }}
        >
          {isTransient && <Loader2 className="h-3 w-3 animate-spin" />}
          {pillLabel}
        </span>
      </div>

      {/* Owner guidance: you don't always need a new number. */}
      {!isTransient && (state === "not_connected" || state === "error") && (
        <div
          className="rounded-xl px-3.5 py-2.5 text-xs leading-relaxed"
          style={{ background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.18)", color: "var(--foreground)" }}
        >
          <p className="font-semibold" style={{ color: "#15803d" }}>לא תמיד צריך מספר חדש</p>
          <p style={{ color: "var(--muted)" }}>
            אם יש לך WhatsApp Business, ייתכן שאפשר לחבר את אותו מספר. אם יש לך WhatsApp אישי רגיל — מומלץ לא לחבר אותו.
          </p>
        </div>
      )}

      {/* Transient progress note — keeps the owner informed while we verify. */}
      {isTransient && (
        <div
          className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm"
          style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.18)", color: "#2563eb" }}
        >
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>{FLOW_LABEL[flowPhase as Exclude<FlowPhase, "idle">]}</span>
        </div>
      )}

      {/* Cancelled / closed without completion */}
      {flowPhase === "cancelled" && !isTransient && (
        <div
          className="rounded-xl px-3.5 py-2.5 text-sm space-y-2"
          style={{ background: "rgba(107,114,128,0.06)", border: "1px solid rgba(107,114,128,0.20)", color: "var(--foreground)" }}
        >
          <div>
            <p className="font-semibold">החיבור לא הושלם</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>אפשר לנסות שוב בכל זמן.</p>
          </div>
          <button
            onClick={() => setConnectError({ kind: "already_registered" })}
            className="text-xs font-semibold underline"
            style={{ color: "#b86b8c" }}
          >
            המספר כבר רשום ב־WhatsApp? כך מחברים מספר קיים
          </button>
        </div>
      )}

      {/* Connected — show display phone */}
      {!isTransient && state === "active" && displayPhoneNumber && !needsNumberConfirmation && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs" style={{ color: "#15803d" }}>
            <CheckCircle2 className="h-4 w-4" />
            <span>מחובר למספר {displayPhoneNumber}</span>
          </div>
          {isTestLookingNumber && (
            <div
              className="rounded-xl px-3.5 py-2.5 text-xs leading-relaxed"
              style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.30)", color: "#92400e" }}
            >
              המספר המחובר נראה כמו מספר בדיקה של Meta. לצורך חיבור מספר עסק אמיתי, יש לנתק
              ולחבר את מספר ה־WhatsApp Business של העסק דרך Meta.
            </div>
          )}
        </div>
      )}

      {/* Connected but awaiting number confirmation — blocks sends until confirmed */}
      {!isTransient && state === "active" && needsNumberConfirmation && (
        <div
          className="rounded-xl px-4 py-3.5 text-sm space-y-3"
          style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.30)", color: "#92400e" }}
        >
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">אישור המספר המחובר</p>
              <p className="text-xs">לפני שליחת הודעות, נא לאשר שזה המספר הנכון.</p>
            </div>
          </div>
          <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(234,179,8,0.25)" }}>
            <p style={{ color: "var(--foreground)" }}>
              מספר מחובר: <span className="font-semibold">{displayPhoneNumber ?? "לא ידוע"}</span>
            </p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              מקור החיבור: {connectionSourceLabel(status.connection.connectionSource)}
            </p>
          </div>
          {isTestLookingNumber && (
            <div
              className="rounded-lg px-3 py-2 text-xs"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#dc2626" }}
            >
              שימי לב: המספר נראה כמו מספר בדיקה של Meta (מתחיל ב־555). אם זה לא המספר העסקי שלך, אל תאשרי — נתקי ונסי שוב.
            </div>
          )}
          <button
            onClick={handleConfirmNumber}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: "#15803d", color: "#fff" }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            זה המספר הנכון
          </button>
        </div>
      )}

      {/* Error reason — owner-friendly, admin sees the detail */}
      {!isTransient && state === "error" && (
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
      {!isTransient && flowPhase !== "cancelled" && state === "not_connected" && (
        <div
          className="space-y-3 rounded-xl px-4 py-3.5"
          style={{ background: "rgba(184,107,140,0.05)", border: "1px solid rgba(184,107,140,0.14)" }}
        >
          <p className="text-xs leading-relaxed" style={{ color: "var(--foreground)" }}>
            כדי לשלוח הודעות אוטומטיות ללקוחות, צריך לחבר את WhatsApp Business של העסק.
            התהליך מתבצע דרך Meta בצורה מאובטחת ולוקח כמה דקות.
          </p>
          <ol className="space-y-2">
            {["בחירת סוג המספר", "אישור ב־Meta", "בדיקת החיבור והכנת הודעות"].map((step, i) => (
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
            onClick={openChooser}
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
            onClick={openChooser}
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
          אם Meta חוסמת מספר שכבר רשום, זו דרישה של Meta — לא תקלה ב־Allura.
        </p>
      )}

      {!embeddedSignupEnabled && (state === "not_connected" || state === "error") && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          חיבור WhatsApp עדיין לא זמין בעסק הזה. צרי קשר עם התמיכה כדי להפעיל אותו.
        </p>
      )}

      {/* Inline connection message */}
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

      {/* Template preparation notice — distinct from the connection state. A
          template failure is shown in amber (warning), not red (connection error). */}
      {templateNotice && (
        <div
          className="rounded-xl px-3.5 py-2.5 text-sm"
          style={{
            background: templateNotice.ok ? "rgba(22,163,74,0.07)" : "rgba(234,179,8,0.08)",
            border: `1px solid ${templateNotice.ok ? "rgba(22,163,74,0.22)" : "rgba(234,179,8,0.28)"}`,
            color: templateNotice.ok ? "#15803d" : "#92400e",
          }}
        >
          {templateNotice.text}
        </div>
      )}

      {/* Template setup — only when connected AND confirmed */}
      {!isTransient && state === "active" && !needsNumberConfirmation && (
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
              className="rounded-xl px-3.5 py-2.5 text-sm space-y-2"
              style={{
                background: templateResult.success ? "rgba(22,163,74,0.07)" : "rgba(234,179,8,0.08)",
                border: `1px solid ${templateResult.success ? "rgba(22,163,74,0.22)" : "rgba(234,179,8,0.28)"}`,
                color: templateResult.success ? "#15803d" : "#92400e",
              }}
            >
              <p className="font-semibold">{templateResult.statusLabel}</p>

              {/* Admin-only template debug table: name · category · language ·
                  local validation · Meta status · last error · fbtrace_id. */}
              {isAdmin && templateResult.items.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                    פרטים טכניים (אדמין בלבד)
                  </p>
                  <ul className="space-y-2 text-xs">
                    {templateResult.items.map((it) => (
                      <li
                        key={it.name}
                        className="rounded-lg px-2.5 py-2 space-y-1"
                        style={{ background: "rgba(255,255,255,0.5)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span style={{ fontFamily: "monospace" }}>{it.name}</span>
                          <span
                            className="font-semibold"
                            style={{ color: it.status === "error" || it.status === "invalid" ? "#dc2626" : "#15803d" }}
                          >
                            {it.status}
                          </span>
                        </div>
                        <div className="opacity-75">
                          קטגוריה: {it.category} · שפה: {it.language} · בדיקה מקומית:{" "}
                          {it.localValid ? "תקין" : "נכשל"}
                        </div>
                        {it.error && (
                          <div style={{ color: "#dc2626" }}>שגיאה: {it.error}</div>
                        )}
                        {it.fbtraceId && (
                          <div className="opacity-60" style={{ fontFamily: "monospace" }}>
                            fbtrace_id: {it.fbtraceId}
                          </div>
                        )}
                        {(it.status === "error" || it.status === "invalid") && (
                          <button
                            onClick={() => handleRetryTemplate(it.name)}
                            disabled={busy}
                            className="mt-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-opacity disabled:opacity-50"
                            style={{ background: "rgba(184,107,140,0.12)", color: "#b86b8c", border: "1px solid rgba(184,107,140,0.25)" }}
                          >
                            נסה ליצור שוב
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
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
            {" · "}flow: <span style={{ fontFamily: "monospace" }}>{flowPhase}</span>
          </p>
          <p className="opacity-80">
            SDK: {sdkLoaded ? "loaded" : "not loaded"} · appId: {appId ? "set" : "missing"} ·
            {" "}configId: {configId ? "set" : "missing"}
          </p>
        </div>
      )}

      {/* ---------- Pre-connection chooser modal ---------- */}
      {chooserOpen && (
        <ChooserModal
          selectedTrack={selectedTrack}
          onSelect={(t) => {
            setSelectedTrack(t);
            setPersonalAck(false);
          }}
          personalAck={personalAck}
          onPersonalAckChange={setPersonalAck}
          canContinue={canContinue}
          onCancel={() => setChooserOpen(false)}
          onContinue={() => selectedTrack && startConnect(selectedTrack)}
        />
      )}

      {/* ---------- Already-registered / generic error modal ---------- */}
      {connectError && (
        <ConnectErrorModal
          error={connectError}
          isAdmin={isAdmin}
          onRetryExisting={() => {
            setConnectError(null);
            startConnect("existing_business_app");
          }}
          onUseNew={() => {
            setConnectError(null);
            startConnect("new_number");
          }}
          onDismiss={() => setConnectError(null)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Pre-connection chooser modal
 * ------------------------------------------------------------------------- */

function ChooserModal({
  selectedTrack,
  onSelect,
  personalAck,
  onPersonalAckChange,
  canContinue,
  onCancel,
  onContinue,
}: {
  selectedTrack: ConnectionTrack | null;
  onSelect: (t: ConnectionTrack) => void;
  personalAck: boolean;
  onPersonalAckChange: (v: boolean) => void;
  canContinue: boolean;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const info = selectedTrack ? getTrackInfo(selectedTrack) : null;
  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      role="dialog"
      aria-modal="true"
      aria-label="בחירת מספר WhatsApp לחיבור"
    >
      <div
        className="w-full max-w-md rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
            איזה מספר WhatsApp תרצי לחבר?
          </h3>
          <button onClick={onCancel} aria-label="סגירה" className="shrink-0">
            <X className="h-5 w-5" style={{ color: "var(--muted)" }} />
          </button>
        </div>

        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          התהליך מתבצע דרך Meta בצורה מאובטחת. בסיום תחזרי ל־Allura ונבדוק שהחיבור הצליח.
        </p>

        <div className="space-y-2.5">
          {CONNECTION_TRACKS.map((t) => {
            const active = selectedTrack === t.track;
            return (
              <button
                key={t.track}
                onClick={() => onSelect(t.track)}
                className="w-full text-right rounded-xl px-3.5 py-3 transition-colors"
                style={{
                  background: active ? "rgba(37,211,102,0.08)" : "var(--surface)",
                  border: `1px solid ${active ? "rgba(37,211,102,0.45)" : "var(--border)"}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    {t.title}
                  </span>
                  {t.recommendedBadge && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: "rgba(37,211,102,0.14)", color: "#15803d" }}
                    >
                      {t.recommendedBadge}
                    </span>
                  )}
                </div>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>
                  {t.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Explanation for the selected track */}
        {info && (
          <div
            className="rounded-xl px-3.5 py-3 text-xs leading-relaxed space-y-2"
            style={{ background: "rgba(184,107,140,0.05)", border: "1px solid rgba(184,107,140,0.16)", color: "var(--foreground)" }}
          >
            <p>{info.explanation}</p>

            {info.warning && (
              <p
                className="rounded-lg px-2.5 py-2 font-semibold"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#dc2626" }}
              >
                {info.warning}
              </p>
            )}

            {/* Personal track acknowledgement gate */}
            {selectedTrack === "personal" && info.ackWarning && (
              <label className="flex items-start gap-2 cursor-pointer pt-1" style={{ color: "#92400e" }}>
                <input
                  type="checkbox"
                  checked={personalAck}
                  onChange={(e) => onPersonalAckChange(e.target.checked)}
                  className="mt-0.5"
                />
                <span>{info.ackWarning}</span>
              </label>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2.5 pt-1">
          <button
            onClick={onCancel}
            className="rounded-xl px-4 py-2.5 text-sm font-medium"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
          >
            ביטול
          </button>
          <button
            onClick={onContinue}
            disabled={!canContinue}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{ background: "#25d366", color: "#fff" }}
          >
            <MessageCircle className="h-4 w-4" />
            המשך לחיבור ב־Meta
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Already-registered / generic error modal
 * ------------------------------------------------------------------------- */

function ConnectErrorModal({
  error,
  isAdmin,
  onRetryExisting,
  onUseNew,
  onDismiss,
}: {
  error: { kind: "already_registered" | "generic"; raw?: string };
  isAdmin: boolean;
  onRetryExisting: () => void;
  onUseNew: () => void;
  onDismiss: () => void;
}) {
  const alreadyRegistered = error.kind === "already_registered";
  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      role="dialog"
      aria-modal="true"
      aria-label="בעיה בחיבור המספר"
    >
      <div
        className="w-full max-w-md rounded-2xl p-5 space-y-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-start gap-2.5">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#b45309" }} />
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
              {alreadyRegistered ? "המספר כבר רשום ב־WhatsApp" : "לא הצלחנו להשלים את החיבור"}
            </h3>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>
              {alreadyRegistered
                ? "אם זה מספר WhatsApp Business, נסי לבחור במסלול ‘יש לי WhatsApp Business קיים’. אם זה מספר אישי רגיל, מומלץ להשתמש במספר עסקי ייעודי או להעביר אותו ל־WhatsApp Business."
                : "משהו השתבש בתהליך החיבור מול Meta. אפשר לנסות שוב, ואם הבעיה נמשכת פני לתמיכה."}
            </p>
            {isAdmin && error.raw && (
              <p className="text-xs mt-2 opacity-70" style={{ fontFamily: "monospace", color: "var(--muted)" }}>
                {error.raw}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onRetryExisting}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: "#25d366", color: "#fff" }}
          >
            לנסות שוב עם WhatsApp Business קיים
          </button>
          <button
            onClick={onUseNew}
            className="rounded-xl px-4 py-2.5 text-sm font-medium"
            style={{ background: "rgba(184,107,140,0.10)", color: "#b86b8c", border: "1px solid rgba(184,107,140,0.25)" }}
          >
            להשתמש במספר חדש
          </button>
          <button
            onClick={onDismiss}
            className="rounded-xl px-4 py-2.5 text-sm font-medium"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
          >
            קראתי והבנתי
          </button>
        </div>
      </div>
    </div>
  );
}
