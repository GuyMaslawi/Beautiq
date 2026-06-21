"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MessageCircle,
  Copy,
  Check,
  CalendarDays,
  Users2,
  User,
} from "lucide-react";
import { BRING_BACK } from "@/lib/constants/he";
import type { ClientSegment, BringBackSummary } from "@/server/bring-back/queries";
import { GrowthOpportunityCard } from "@/components/premium/opportunity-card";
import { PremiumEmptyState } from "@/components/premium/empty-state";
import type { ToneKey } from "@/components/premium/tokens";

// ── Serialised client shape ───────────────────────────────────────────────────

export interface BringBackClientSerialized {
  id: string;
  fullName: string;
  phone: string;
  lastVisitAtISO: string;
  lastServiceName: string;
  daysSinceLastVisit: number;
  segment: ClientSegment;
  totalCompletedBookings: number;
  totalRevenue: number;
}

// ── Offer options (for manual message) ───────────────────────────────────────

const OFFER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: BRING_BACK.message.offers.none },
  { value: "מגיעה לך הנחה של 10% בתור הבא 🎁", label: BRING_BACK.message.offers.discount10 },
  { value: "שדרוג טיפול מתנה בתור הקרוב 🌟", label: BRING_BACK.message.offers.upgrade },
  { value: "יש לנו תור פנוי מיוחד בשבוע הקרוב — רק בשבילך 🗓️", label: BRING_BACK.message.offers.specialSlot },
];

// segment → label + tone
const SEGMENT_META: Record<ClientSegment, { label: string; tone: ToneKey }> = {
  critical: { label: "קריטי · 90+ ימים", tone: "danger" },
  high: { label: "דחוף · 60+ ימים", tone: "warning" },
  medium: { label: "למעקב", tone: "brand" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitial(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? "?";
}

// ── ClientCard ────────────────────────────────────────────────────────────────

function ClientCard({
  client,
  businessName,
}: {
  client: BringBackClientSerialized;
  businessName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState("");
  const [copied, setCopied] = useState(false);

  const message = BRING_BACK.message.build(
    client.fullName,
    businessName,
    client.lastServiceName,
    selectedOffer,
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      // fallback — message visible so user can copy manually
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const seg = SEGMENT_META[client.segment];

  return (
    <GrowthOpportunityCard
      name={client.fullName}
      initials={getInitial(client.fullName)}
      reason={`לא ביקרה ${client.daysSinceLastVisit} ימים · טיפול אחרון: ${client.lastServiceName}`}
      value={client.totalRevenue > 0 ? `₪${Math.round(client.totalRevenue).toLocaleString("he-IL")}` : undefined}
      valueLabel="ערך לקוחה"
      segment={seg.label}
      segmentTone={seg.tone}
      meta={
        <span className="flex items-center gap-1">
          <Users2 className="h-3 w-3" />
          {client.totalCompletedBookings} תורים בעבר
        </span>
      }
      open={expanded}
      actions={
        <>
          <Link
            href={`/bookings/new?clientId=${client.id}`}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: "rgba(184,107,140,0.1)", color: "#b86b8c", border: "1px solid rgba(184,107,140,0.22)" }}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            קבעי תור
          </Link>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #25d366 0%, #1ab954 100%)", boxShadow: "0 6px 16px -6px rgba(37,211,102,0.55)" }}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {expanded ? BRING_BACK.card.closeMessage : "שלחי הודעה"}
          </button>
        </>
      }
      expanded={
        <div>
          {/* Offer selector */}
          <div className="mb-3">
            <label className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--muted)" }}>
              {BRING_BACK.message.offerLabel}
            </label>
            <div className="flex flex-wrap gap-2">
              {OFFER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedOffer(opt.value)}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-all"
                  style={
                    selectedOffer === opt.value
                      ? { background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)", color: "#fff" }
                      : { background: "var(--background-alt)", color: "var(--muted)", border: "1px solid var(--border)" }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message preview */}
          <div
            className="mb-3 rounded-xl p-3.5 text-sm leading-relaxed"
            style={{
              background: "rgba(37,211,102,0.06)",
              border: "1px solid rgba(37,211,102,0.18)",
              color: "var(--foreground)",
              whiteSpace: "pre-wrap",
              direction: "rtl",
            }}
          >
            {message}
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{
              background: copied
                ? "linear-gradient(135deg, #3d8b6e 0%, #2d7060 100%)"
                : "linear-gradient(135deg, #25d366 0%, #1ab954 100%)",
            }}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                <span>{BRING_BACK.message.copied}</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>{BRING_BACK.message.copyButton}</span>
              </>
            )}
          </button>

          {/* Profile link */}
          <div className="mt-2.5 flex justify-center">
            <Link
              href={`/clients/${client.id}`}
              className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
              style={{ color: "var(--muted)" }}
            >
              <User className="h-3 w-3" />
              {BRING_BACK.card.viewProfile}
            </Link>
          </div>
        </div>
      }
    />
  );
}

// ── BringBackHub (main export) ────────────────────────────────────────────────

interface BringBackHubProps {
  clients: BringBackClientSerialized[];
  summary: BringBackSummary;
  thresholdDays: number;
  businessName: string;
}

export function BringBackHub({ clients, businessName }: BringBackHubProps) {
  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2.5">
        <h3 className="text-foreground text-base font-bold">לקוחות שלא חזרו</h3>
        {clients.length > 0 && (
          <span
            className="display-num rounded-full px-2.5 py-0.5 text-sm font-bold"
            style={{ background: "rgba(184,107,140,0.12)", color: "#b86b8c" }}
          >
            {clients.length}
          </span>
        )}
      </div>

      {/* Client list or empty state */}
      {clients.length === 0 ? (
        <PremiumEmptyState
          tint="sage"
          title={BRING_BACK.emptyState.title}
          body={BRING_BACK.emptyState.body}
          cta={BRING_BACK.emptyState.cta}
          ctaHref={BRING_BACK.emptyState.ctaHref}
          icon={<Users2 className="h-7 w-7" />}
        />
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} businessName={businessName} />
          ))}
        </div>
      )}
    </div>
  );
}
