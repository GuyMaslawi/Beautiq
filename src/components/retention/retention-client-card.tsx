"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, CalendarPlus, User, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RETENTION } from "@/lib/constants/he";
import { generateRetentionMessage } from "@/lib/retention/messages";
import type { RetentionClient } from "@/server/retention/queries";

interface RetentionClientCardProps {
  client: RetentionClient;
  businessName: string;
  lastVisitFormatted: string;
}

export function RetentionClientCard({
  client,
  businessName,
  lastVisitFormatted,
}: RetentionClientCardProps) {
  const [showMessage, setShowMessage] = useState(false);
  const [copied, setCopied] = useState(false);

  const message = generateRetentionMessage({
    clientName: client.fullName,
    businessName,
    serviceName: client.lastServiceName,
  });

  async function handleCopy() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // fallback: do nothing — the textarea below is always visible when message is open
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
          <p className="text-muted text-sm mt-0.5" dir="ltr">
            {client.phone}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
          {RETENTION.card.daysSince(client.daysSinceLastVisit)}
        </span>
      </div>

      {/* Last visit info */}
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted">{RETENTION.card.lastService}:</span>
          <span className="text-foreground font-medium">{client.lastServiceName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted">{RETENTION.card.lastVisit}:</span>
          <span className="text-foreground">{lastVisitFormatted}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted">{RETENTION.card.totalVisits}:</span>
          <span className="text-foreground">{client.totalCompletedBookings}</span>
        </div>
      </div>

      {/* Hints row */}
      {(client.hasNoShow || client.hasCancellations) && (
        <div className="flex flex-wrap gap-1.5">
          {client.hasNoShow && (
            <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs text-red-700">
              {RETENTION.card.noShowHint}
            </span>
          )}
          {client.hasCancellations && (
            <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2.5 py-0.5 text-xs text-yellow-700">
              {RETENTION.card.cancellationHint}
            </span>
          )}
        </div>
      )}

      {/* Message preview */}
      {showMessage && (
        <div className="rounded-xl border border-border bg-surface p-3.5 space-y-3">
          <p className="text-muted text-xs font-semibold uppercase tracking-wider">
            {RETENTION.message.sectionTitle}
          </p>
          <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">
            {message}
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="w-full justify-center"
            onClick={handleCopy}
          >
            {copied
              ? `✓ ${RETENTION.message.copied}`
              : RETENTION.message.copyButton}
          </Button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5"
          onClick={() => setShowMessage((v) => !v)}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {showMessage ? (
            <>
              {RETENTION.message.close}
              <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              {RETENTION.card.prepareMessage}
              <ChevronDown className="h-3 w-3" />
            </>
          )}
        </Button>
        <Link href={`/bookings/new?clientId=${client.id}`}>
          <Button size="sm" variant="secondary" className="gap-1.5">
            <CalendarPlus className="h-3.5 w-3.5" />
            {RETENTION.card.newBooking}
          </Button>
        </Link>
        <Link href={`/clients/${client.id}`}>
          <Button size="sm" variant="ghost" className="gap-1.5 text-muted">
            <User className="h-3.5 w-3.5" />
            {RETENTION.card.viewDetails}
          </Button>
        </Link>
      </div>
    </Card>
  );
}
