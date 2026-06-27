"use client";

import { useState } from "react";
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
      <p className="text-xs" style={{ color: "#888" }}>
        חיבור WhatsApp לעסק בדיקה — משתמש בנתוני env המערכת (Mode A).
        מיועד לניהול ובדיקות בלבד. הבעלים לא רואה אפשרות זו.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleDiagnostic}
          disabled={loadingDiag}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          style={{ background: "#f3f4f6", color: "#333", border: "1px solid #e5e7eb" }}
        >
          {loadingDiag ? "בודק..." : "בדיקת חיבור WhatsApp"}
        </button>

        <button
          onClick={handleConnect}
          disabled={loadingConnect}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          style={{ background: "#0ea5e9", color: "#fff" }}
        >
          {loadingConnect ? "מחבר..." : "חיבור WhatsApp לעסק בדיקה"}
        </button>

        <button
          onClick={handleConfirmNumber}
          disabled={loadingConfirm}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          style={{ background: "#16a34a", color: "#fff" }}
        >
          {loadingConfirm ? "מאמת..." : "אישור המספר המחובר"}
        </button>

        <button
          onClick={handleCreateTemplates}
          disabled={loadingTpl}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          style={{ background: "#b86b8c", color: "#fff" }}
        >
          {loadingTpl ? "פועל..." : "יצירת תבניות"}
        </button>

        <button
          onClick={handleSyncTemplates}
          disabled={loadingTpl}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          style={{ background: "#f3f4f6", color: "#333", border: "1px solid #e5e7eb" }}
        >
          {loadingTpl ? "מסנכרן..." : "סנכרון תבניות"}
        </button>

        <button
          onClick={handleDisconnect}
          disabled={loadingConnect}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
        >
          ניתוק
        </button>
      </div>

      {/* Connect result */}
      {connectResult && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: connectResult.success ? "rgba(22,163,74,0.07)" : "rgba(220,38,38,0.07)",
            border: `1px solid ${connectResult.success ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.25)"}`,
            color: connectResult.success ? "#15803d" : "#dc2626",
          }}
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
          style={{
            background: confirmResult.success ? "rgba(22,163,74,0.07)" : "rgba(220,38,38,0.07)",
            border: `1px solid ${confirmResult.success ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.25)"}`,
            color: confirmResult.success ? "#15803d" : "#dc2626",
          }}
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
          className="rounded-xl px-4 py-3 text-sm space-y-1.5"
          style={{
            background: templateResult.success ? "rgba(22,163,74,0.07)" : "rgba(234,179,8,0.08)",
            border: `1px solid ${templateResult.success ? "rgba(22,163,74,0.25)" : "rgba(234,179,8,0.30)"}`,
            color: templateResult.success ? "#15803d" : "#92400e",
          }}
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
          className="rounded-xl border p-4 space-y-2 text-xs"
          style={{ borderColor: "#e5e7eb", background: "#0b1020", color: "#cbd5e1" }}
        >
          <p className="text-sm font-semibold" style={{ color: "#fff" }}>
            דיאגנוסטיקת סנכרון תבניות (מנהל בלבד)
          </p>

          <p style={{ color: "#fde68a" }}>{templateResult.syncDiagnostics.hint}</p>

          <div className="space-y-0.5" style={{ direction: "ltr" }}>
            <div>WABA ID (listTemplates): <b>{templateResult.syncDiagnostics.wabaId ?? "(unset)"}</b></div>
            <div>WABA ID source: <b>{templateResult.syncDiagnostics.wabaIdSource}</b></div>
            <div>META_WHATSAPP_WABA_ID loaded: <b>{templateResult.syncDiagnostics.envWabaIdPresent ? "yes" : "no"}</b></div>
            <div>Phone Number ID (send): <b>{templateResult.syncDiagnostics.phoneNumberId ?? "(unset)"}</b> (source: {templateResult.syncDiagnostics.phoneNumberIdSource})</div>
            <div>Credential mode: <b>{templateResult.syncDiagnostics.credentialMode}</b></div>
            <div>Graph API version: <b>{templateResult.syncDiagnostics.apiVersion}</b></div>
            <div>Templates returned by Meta: <b>{templateResult.syncDiagnostics.returnedCount}</b></div>
            {templateResult.syncDiagnostics.listError && (
              <div style={{ color: "#fca5a5" }}>
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
              <div className="font-semibold" style={{ color: "#fff" }}>
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
            <div className="font-semibold" style={{ color: "#fff" }}>
              Expected (name · language → matched):
            </div>
            {templateResult.syncDiagnostics.expected.map((e) => (
              <div key={e.name} style={{ color: e.matched ? "#86efac" : "#fca5a5" }}>
                {e.name} · {e.language} → {e.matched ? "matched" : "NOT FOUND"}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diagnostic result */}
      {diagnostic && (
        <div
          className="rounded-xl border p-4 space-y-2"
          style={{ borderColor: diagnostic.ok ? "rgba(22,163,74,0.25)" : "rgba(234,179,8,0.35)", background: "#fafafa" }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: diagnostic.ok ? "#15803d" : "#92400e" }}
          >
            {diagnostic.statusLabel}
          </p>
          <div className="space-y-1">
            {diagnostic.details.map((d, i) => (
              <div key={i} className="flex items-start gap-2 text-xs" style={{ color: "#555" }}>
                <span style={{ color: d.ok ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                  {d.ok ? "✓" : "✗"}
                </span>
                <span>
                  {d.label}
                  {d.value ? <span style={{ color: "#888" }}> — {d.value}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
