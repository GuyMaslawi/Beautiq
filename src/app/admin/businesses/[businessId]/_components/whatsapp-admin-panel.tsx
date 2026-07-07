"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import {
  adminConnectBusinessFromEnv,
  adminCheckWhatsAppDiagnostic,
  adminCreateTemplatesForBusiness,
  adminSyncTemplatesForBusiness,
  adminDisconnectBusiness,
  adminConfirmConnectedNumber,
  type ConnectFromEnvResult,
  type ConfirmNumberResult,
} from "@/server/admin/whatsapp-actions";
import type { WhatsAppDiagnosticResult } from "@/server/whatsapp/resolver";
import type { TemplateSetupResult } from "@/server/whatsapp/templates-core";

interface Props {
  businessId: string;
}

/* Token-based result surface styles */
const resultBox = (tone: "success" | "error" | "warning") => ({
  background: `var(--${tone}-light)`,
  border: `1px solid color-mix(in srgb, var(--${tone}) 30%, transparent)`,
  color: `var(--${tone})`,
});

const secondaryBtn =
  "rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground-soft transition-colors hover:bg-background-alt disabled:opacity-50";

export function WhatsAppAdminPanel({ businessId }: Props) {
  const [diagnostic, setDiagnostic] = useState<WhatsAppDiagnosticResult | null>(null);
  const [connectResult, setConnectResult] = useState<ConnectFromEnvResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmNumberResult | null>(null);
  const [templateResult, setTemplateResult] = useState<TemplateSetupResult | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [loadingConnect, setLoadingConnect] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [loadingTpl, setLoadingTpl] = useState(false);

  async function handleCreateTemplates() {
    setLoadingTpl(true);
    setTemplateResult(null);
    try {
      setTemplateResult(await adminCreateTemplatesForBusiness(businessId));
    } finally {
      setLoadingTpl(false);
    }
  }

  async function handleSyncTemplates() {
    setLoadingTpl(true);
    setTemplateResult(null);
    try {
      setTemplateResult(await adminSyncTemplatesForBusiness(businessId));
    } finally {
      setLoadingTpl(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("לנתק את חיבור ה-WhatsApp של העסק ולמחוק את הטוקן השמור?")) return;
    setLoadingConnect(true);
    try {
      await adminDisconnectBusiness(businessId);
      setConnectResult(null);
      setTemplateResult(null);
      setDiagnostic(await adminCheckWhatsAppDiagnostic(businessId));
    } finally {
      setLoadingConnect(false);
    }
  }

  async function handleDiagnostic() {
    setLoadingDiag(true);
    setDiagnostic(null);
    try {
      const result = await adminCheckWhatsAppDiagnostic(businessId);
      setDiagnostic(result);
    } finally {
      setLoadingDiag(false);
    }
  }

  async function handleConnect() {
    setLoadingConnect(true);
    setConnectResult(null);
    try {
      const result = await adminConnectBusinessFromEnv(businessId);
      setConnectResult(result);
      // Refresh diagnostic after connect
      const diag = await adminCheckWhatsAppDiagnostic(businessId);
      setDiagnostic(diag);
    } finally {
      setLoadingConnect(false);
    }
  }

  async function handleConfirmNumber() {
    setLoadingConfirm(true);
    setConfirmResult(null);
    try {
      const result = await adminConfirmConnectedNumber(businessId);
      setConfirmResult(result);
      // Refresh diagnostic so the gate/sends-allowed rows update immediately
      const diag = await adminCheckWhatsAppDiagnostic(businessId);
      setDiagnostic(diag);
    } finally {
      setLoadingConfirm(false);
    }
  }

  return (
    <div dir="rtl" className="space-y-4">
      <p className="text-xs text-muted">
        חיבור WhatsApp לעסק בדיקה — משתמש בנתוני env המערכת (Mode A).
        מיועד לניהול ובדיקות בלבד. הבעלים לא רואה אפשרות זו.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleDiagnostic}
          disabled={loadingDiag}
          className={secondaryBtn}
        >
          {loadingDiag ? "בודק..." : "בדיקת חיבור WhatsApp"}
        </button>

        <button
          onClick={handleConnect}
          disabled={loadingConnect}
          className="rounded-xl px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--info)" }}
        >
          {loadingConnect ? "מחבר..." : "חיבור WhatsApp לעסק בדיקה"}
        </button>

        <button
          onClick={handleConfirmNumber}
          disabled={loadingConfirm}
          className="rounded-xl px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--success)" }}
        >
          {loadingConfirm ? "מאמת..." : "אישור המספר המחובר"}
        </button>

        <button
          onClick={handleCreateTemplates}
          disabled={loadingTpl}
          className="bg-brand-gradient rounded-xl px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loadingTpl ? "פועל..." : "יצירת תבניות"}
        </button>

        <button
          onClick={handleSyncTemplates}
          disabled={loadingTpl}
          className={secondaryBtn}
        >
          {loadingTpl ? "מסנכרן..." : "סנכרון תבניות"}
        </button>

        <button
          onClick={handleDisconnect}
          disabled={loadingConnect}
          className="rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50"
          style={resultBox("error")}
        >
          ניתוק
        </button>
      </div>

      {/* Connect result */}
      {connectResult && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={resultBox(connectResult.success ? "success" : "error")}
        >
          <p className="font-semibold">{connectResult.statusLabel}</p>
          {connectResult.phoneNumberId && (
            <p className="mt-1 text-xs opacity-75">Phone Number ID: {connectResult.phoneNumberId}</p>
          )}
        </div>
      )}

      {/* Confirm-number result */}
      {confirmResult && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={resultBox(confirmResult.success ? "success" : "error")}
        >
          <p className="font-semibold">{confirmResult.statusLabel}</p>
          {confirmResult.phoneNumberId && (
            <p className="mt-1 text-xs opacity-75">Phone Number ID: {confirmResult.phoneNumberId}</p>
          )}
          {confirmResult.confirmedAt && (
            <p className="mt-0.5 text-xs opacity-75">numberConfirmedAt: {confirmResult.confirmedAt}</p>
          )}
        </div>
      )}

      {/* Template setup result */}
      {templateResult && (
        <div
          className="space-y-1.5 rounded-xl px-4 py-3 text-sm"
          style={resultBox(templateResult.success ? "success" : "warning")}
        >
          <p className="font-semibold">{templateResult.statusLabel}</p>
          {templateResult.items.length > 0 && (
            <ul className="space-y-0.5 text-xs opacity-80" style={{ direction: "ltr" }}>
              {templateResult.items.map((it) => (
                <li key={it.name}>
                  {it.name} — {it.status}
                  {it.error ? ` (${it.error})` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Sync diagnostics (admin-only, token-free) */}
      {templateResult?.syncDiagnostics && (
        <div
          className="space-y-2 rounded-xl p-4 text-xs"
          style={{
            background:
              "linear-gradient(135deg, var(--sidebar-bg-from) 0%, var(--sidebar-bg-mid) 55%, var(--sidebar-bg-to) 100%)",
            border: "1px solid var(--sidebar-border)",
            color: "var(--sidebar-fg-muted)",
          }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--sidebar-fg)" }}>
            דיאגנוסטיקת סנכרון תבניות (מנהל בלבד)
          </p>

          <p style={{ color: "#e3c79a" }}>{templateResult.syncDiagnostics.hint}</p>

          <div className="space-y-0.5" style={{ direction: "ltr" }}>
            <div>WABA ID (listTemplates): <b style={{ color: "var(--sidebar-fg)" }}>{templateResult.syncDiagnostics.wabaId ?? "(unset)"}</b></div>
            <div>WABA ID source: <b style={{ color: "var(--sidebar-fg)" }}>{templateResult.syncDiagnostics.wabaIdSource}</b></div>
            <div>META_WHATSAPP_WABA_ID loaded: <b style={{ color: "var(--sidebar-fg)" }}>{templateResult.syncDiagnostics.envWabaIdPresent ? "yes" : "no"}</b></div>
            <div>Phone Number ID (send): <b style={{ color: "var(--sidebar-fg)" }}>{templateResult.syncDiagnostics.phoneNumberId ?? "(unset)"}</b> (source: {templateResult.syncDiagnostics.phoneNumberIdSource})</div>
            <div>Credential mode: <b style={{ color: "var(--sidebar-fg)" }}>{templateResult.syncDiagnostics.credentialMode}</b></div>
            <div>Graph API version: <b style={{ color: "var(--sidebar-fg)" }}>{templateResult.syncDiagnostics.apiVersion}</b></div>
            <div>Templates returned by Meta: <b style={{ color: "var(--sidebar-fg)" }}>{templateResult.syncDiagnostics.returnedCount}</b></div>
            {templateResult.syncDiagnostics.listError && (
              <div style={{ color: "#f09090" }}>
                listTemplates error: {templateResult.syncDiagnostics.listError}
                {typeof templateResult.syncDiagnostics.listErrorCode === "number"
                  ? ` (code ${templateResult.syncDiagnostics.listErrorCode}`
                  : ""}
                {templateResult.syncDiagnostics.listErrorType
                  ? ` · ${templateResult.syncDiagnostics.listErrorType})`
                  : typeof templateResult.syncDiagnostics.listErrorCode === "number"
                    ? ")"
                    : ""}
              </div>
            )}
          </div>

          {templateResult.syncDiagnostics.returnedTemplates.length > 0 && (
            <div className="space-y-0.5" style={{ direction: "ltr" }}>
              <div className="font-semibold" style={{ color: "var(--sidebar-fg)" }}>
                Returned templates (name · language · category · status):
              </div>
              {templateResult.syncDiagnostics.returnedTemplates.map((t, i) => (
                <div key={`${t.name}-${t.language}-${i}`}>
                  {t.name} · {t.language} · {t.category ?? "—"} · {t.rawStatus ?? "?"} → {t.status}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-0.5" style={{ direction: "ltr" }}>
            <div className="font-semibold" style={{ color: "var(--sidebar-fg)" }}>
              Expected (name · language → matched):
            </div>
            {templateResult.syncDiagnostics.expected.map((e) => (
              <div key={e.name} style={{ color: e.matched ? "#6fc1a0" : "#f09090" }}>
                {e.name} · {e.language} → {e.matched ? "matched" : "NOT FOUND"}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diagnostic result */}
      {diagnostic && (
        <div
          className="space-y-2 rounded-xl border bg-background-alt/60 p-4"
          style={{
            borderColor: `color-mix(in srgb, var(--${diagnostic.ok ? "success" : "warning"}) 35%, transparent)`,
          }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: diagnostic.ok ? "var(--success)" : "var(--warning)" }}
          >
            {diagnostic.statusLabel}
          </p>
          <div className="space-y-1">
            {diagnostic.details.map((d, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-foreground-soft">
                {d.ok ? (
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--success)" }} />
                ) : (
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--error)" }} />
                )}
                <span>
                  {d.label}
                  {d.value ? <span className="text-muted"> — {d.value}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
