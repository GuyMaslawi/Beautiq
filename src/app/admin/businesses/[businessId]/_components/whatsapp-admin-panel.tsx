"use client";

import { useState } from "react";
import {
  adminConnectBusinessFromEnv,
  adminCheckWhatsAppDiagnostic,
  type ConnectFromEnvResult,
} from "@/server/admin/whatsapp-actions";
import type { WhatsAppDiagnosticResult } from "@/server/whatsapp/resolver";

interface Props {
  businessId: string;
}

export function WhatsAppAdminPanel({ businessId }: Props) {
  const [diagnostic, setDiagnostic] = useState<WhatsAppDiagnosticResult | null>(null);
  const [connectResult, setConnectResult] = useState<ConnectFromEnvResult | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [loadingConnect, setLoadingConnect] = useState(false);

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
