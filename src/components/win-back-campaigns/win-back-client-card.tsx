"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, CalendarPlus, User, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WIN_BACK } from "@/lib/constants/he";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import type { WinBackClient, CampaignType } from "@/server/win-back-campaigns/queries";
import { generateWinBackMessage } from "@/lib/win-back-campaigns/messages";

function formatILS(amount: number): string {
  return `₪${Math.round(amount).toLocaleString("en-US")}`;
}

interface WinBackClientCardProps {
  client: WinBackClient;
  campaignType: CampaignType;
  businessName: string;
  lastVisitFormatted: string;
}

export function WinBackClientCard({
  client,
  campaignType,
  businessName,
  lastVisitFormatted,
}: WinBackClientCardProps) {
  const [showMessage, setShowMessage] = useState(false);
  const [copied, setCopied] = useState(false);

  const message = generateWinBackMessage({
    campaignType,
    clientName: client.fullName,
    businessName,
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
      // fallback: message is visible in preview
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
        <span
          className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
          style={{
            background: "rgba(184,107,140,0.08)",
            borderColor: "rgba(184,107,140,0.22)",
            color: "#8a4070",
          }}
        >
          {WIN_BACK.card.daysAgo(client.daysSinceLastVisit)}
        </span>
      </div>

      {/* Info rows */}
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted">{WIN_BACK.card.lastVisit}:</span>
          <span className="text-foreground">{lastVisitFormatted}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted">{WIN_BACK.card.lastService}:</span>
          <span className="text-foreground font-medium">{client.lastServiceName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted">{WIN_BACK.card.totalVisits}:</span>
          <span className="text-foreground">{client.totalCompletedBookings}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted">{WIN_BACK.card.totalRevenue}:</span>
          <span className="text-foreground font-medium">{formatILS(client.totalRevenue)}</span>
        </div>
      </div>

      {/* Message preview */}
      {showMessage && (
        <div className="rounded-xl border border-border bg-surface p-3.5 space-y-3">
          <p className="text-muted text-xs font-semibold uppercase tracking-wider">
            {WIN_BACK.card.messagePreviewTitle}
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
            {WIN_BACK.card.openWhatsApp}
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
            {WIN_BACK.card.openWhatsApp}
          </span>
        )}
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5"
          onClick={handleCopy}
        >
          {copied ? (
            <><Check className="h-3.5 w-3.5" />{WIN_BACK.card.messageCopied}</>
          ) : (
            <><Copy className="h-3.5 w-3.5" />{WIN_BACK.card.copyMessage}</>
          )}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5"
          onClick={() => setShowMessage((v) => !v)}
        >
          {showMessage ? (
            <>{WIN_BACK.card.closeMessage}<ChevronUp className="h-3 w-3" /></>
          ) : (
            <>{WIN_BACK.card.showMessage}<ChevronDown className="h-3 w-3" /></>
          )}
        </Button>
        <Link href={`/bookings/new?clientId=${client.id}`}>
          <Button size="sm" variant="secondary" className="gap-1.5">
            <CalendarPlus className="h-3.5 w-3.5" />
            {WIN_BACK.card.newBooking}
          </Button>
        </Link>
        <Link href={`/clients/${client.id}`}>
          <Button size="sm" variant="ghost" className="gap-1.5 text-muted">
            <User className="h-3.5 w-3.5" />
            {WIN_BACK.card.viewClient}
          </Button>
        </Link>
      </div>
    </Card>
  );
}
