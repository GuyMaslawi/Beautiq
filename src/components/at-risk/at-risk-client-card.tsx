"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, CalendarPlus, User, Copy, Check, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AT_RISK } from "@/lib/constants/he";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import type { AtRiskClient, RiskLevel } from "@/server/at-risk/queries";

interface AtRiskClientCardProps {
  client: AtRiskClient;
  businessName: string;
  lastVisitFormatted: string;
}

const RISK_COLORS: Record<RiskLevel, { bg: string; border: string; text: string; badge: string; badgeBg: string }> = {
  low: {
    bg: "rgba(254,246,228,0.80)",
    border: "rgba(184,150,10,0.22)",
    text: "#7a6400",
    badge: "bg-yellow-50 border-yellow-200 text-yellow-700",
    badgeBg: "rgba(254,246,228,0.80)",
  },
  medium: {
    bg: "rgba(255,243,232,0.80)",
    border: "rgba(220,120,40,0.22)",
    text: "#8a4a10",
    badge: "bg-orange-50 border-orange-200 text-orange-700",
    badgeBg: "rgba(255,243,232,0.80)",
  },
  high: {
    bg: "rgba(255,235,235,0.80)",
    border: "rgba(200,60,60,0.22)",
    text: "#8b2020",
    badge: "bg-red-50 border-red-200 text-red-700",
    badgeBg: "rgba(255,235,235,0.80)",
  },
  critical: {
    bg: "rgba(245,220,220,0.85)",
    border: "rgba(180,30,30,0.30)",
    text: "#6b1010",
    badge: "bg-red-100 border-red-300 text-red-800",
    badgeBg: "rgba(245,220,220,0.85)",
  },
};

function generateAtRiskMessage(params: {
  clientName: string;
  businessName: string;
  serviceName: string;
}): string {
  const { clientName, businessName, serviceName } = params;
  return `היי ${clientName}, כאן ${businessName} 🌸\nהתגעגענו! הביקור האחרון שלך היה ל${serviceName}.\nנשמח מאוד לראות אותך שוב — אם תרצי לקבוע תור, אנחנו כאן בשבילך ❤️`;
}

function formatILS(amount: number): string {
  return `₪${Math.round(amount).toLocaleString("en-US")}`;
}

export function AtRiskClientCard({
  client,
  businessName,
  lastVisitFormatted,
}: AtRiskClientCardProps) {
  const [showMessage, setShowMessage] = useState(false);
  const [copied, setCopied] = useState(false);

  const colors = RISK_COLORS[client.riskLevel];

  const message = generateAtRiskMessage({
    clientName: client.fullName,
    businessName,
    serviceName: client.lastServiceName,
  });

  const waUrl = buildWhatsAppUrl(client.phone, message);

  async function handleCopy() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // fallback: textarea is visible
    }
  }

  return (
    <Card className="p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-foreground font-semibold text-base leading-tight">
            {client.fullName}
          </p>
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm mt-0.5 inline-block transition-opacity hover:opacity-70"
              style={{ color: "#1a9e4e" }}
              dir="ltr"
            >
              {client.phone}
            </a>
          ) : (
            <span className="text-sm mt-0.5 inline-block" style={{ color: "var(--muted)" }} dir="ltr">
              {client.phone}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {/* Risk level badge */}
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colors.badge}`}
          >
            {AT_RISK.riskLevel[client.riskLevel]}
          </span>
          {/* Days since */}
          <span className="text-xs font-medium" style={{ color: colors.text }}>
            {AT_RISK.card.daysAgo(client.daysSinceLastVisit)}
          </span>
        </div>
      </div>

      {/* Info rows */}
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted">{AT_RISK.card.lastVisit}:</span>
          <span className="text-foreground">{lastVisitFormatted}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted">שירות אחרון:</span>
          <span className="text-foreground font-medium">{client.lastServiceName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted">{AT_RISK.card.totalVisits}:</span>
          <span className="text-foreground">{client.totalCompletedBookings}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted">{AT_RISK.card.totalRevenue}:</span>
          <span className="text-foreground font-medium">{formatILS(client.totalRevenue)}</span>
        </div>
      </div>

      {/* Critical/High warning hint */}
      {(client.riskLevel === "critical" || client.riskLevel === "high") && (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
          style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: colors.text }} />
          <span style={{ color: colors.text }}>
            {client.riskLevel === "critical"
              ? "הלקוחה לא חזרה יותר מ-90 יום — כדאי לפנות בהקדם"
              : "הלקוחה לא חזרה יותר מ-60 יום"}
          </span>
        </div>
      )}

      {/* Message preview */}
      {showMessage && (
        <div className="rounded-xl border border-border bg-surface p-3.5 space-y-2">
          <p className="text-muted text-xs font-semibold uppercase tracking-wider">
            {AT_RISK.card.messageSectionTitle}
          </p>
          <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">
            {message}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90"
            style={{
              background: "rgba(37,211,102,0.10)",
              color: "#1a9e4e",
              border: "1px solid rgba(37,211,102,0.22)",
            }}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {AT_RISK.card.openWhatsApp}
          </a>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold opacity-40 cursor-not-allowed"
            title="מספר טלפון לא תקין"
            style={{
              background: "rgba(37,211,102,0.06)",
              color: "#1a9e4e",
              border: "1px solid rgba(37,211,102,0.12)",
            }}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {AT_RISK.card.openWhatsApp}
          </span>
        )}
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5"
          onClick={handleCopy}
        >
          {copied ? (
            <><Check className="h-3.5 w-3.5" />{AT_RISK.card.messageCopied}</>
          ) : (
            <><Copy className="h-3.5 w-3.5" />{AT_RISK.card.copyMessage}</>
          )}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5"
          onClick={() => setShowMessage((v) => !v)}
        >
          {showMessage ? (
            <>
              {AT_RISK.card.closeMessage}
              <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              {AT_RISK.card.sendMessage}
              <ChevronDown className="h-3 w-3" />
            </>
          )}
        </Button>
        <Link href={`/bookings/new?clientId=${client.id}`}>
          <Button size="sm" variant="secondary" className="gap-1.5">
            <CalendarPlus className="h-3.5 w-3.5" />
            {AT_RISK.card.newBooking}
          </Button>
        </Link>
        <Link href={`/clients/${client.id}`}>
          <Button size="sm" variant="ghost" className="gap-1.5 text-muted">
            <User className="h-3.5 w-3.5" />
            {AT_RISK.card.viewClient}
          </Button>
        </Link>
      </div>
    </Card>
  );
}
