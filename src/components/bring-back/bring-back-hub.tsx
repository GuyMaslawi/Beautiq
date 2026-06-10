"use client";

import { useState } from "react";
import Link from "next/link";
import {
  RefreshCcw,
  MessageCircle,
  Copy,
  Check,
  CalendarDays,
  Users2,
  User,
} from "lucide-react";
import { BRING_BACK } from "@/lib/constants/he";
import type { ClientSegment, BringBackSummary } from "@/server/bring-back/queries";

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

  return (
    <div
      className="overflow-hidden rounded-2xl transition-shadow"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Card row */}
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        {/* Avatar */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{
            background:
              "linear-gradient(135deg, rgba(201,120,152,0.85) 0%, rgba(184,107,140,0.75) 100%)",
          }}
        >
          {getInitial(client.fullName)}
        </div>

        {/* Name + days */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            {client.fullName}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
            לא ביקרה {client.daysSinceLastVisit} ימים
          </p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/bookings/new?clientId=${client.id}`}
            className="rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
            style={{
              background: "rgba(184,107,140,0.08)",
              color: "#b86b8c",
              border: "1px solid rgba(184,107,140,0.18)",
            }}
          >
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              קבעי תור
            </span>
          </Link>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
            style={{
              background: expanded ? "rgba(37,211,102,0.10)" : "rgba(37,211,102,0.07)",
              color: "#1a9e4e",
              border: "1px solid rgba(37,211,102,0.20)",
            }}
          >
            <MessageCircle className="h-3 w-3" />
            {expanded ? BRING_BACK.card.closeMessage : "שלחי הודעה"}
          </button>
        </div>
      </div>

      {/* Expanded message section */}
      {expanded && (
        <div
          className="px-4 pb-4 pt-0"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="pt-3">
            {/* Offer selector */}
            <div className="mb-3">
              <label
                className="mb-1.5 block text-xs font-semibold"
                style={{ color: "var(--muted)" }}
              >
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
                        ? {
                            background:
                              "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
                            color: "#fff",
                          }
                        : {
                            background: "var(--background-alt)",
                            color: "var(--muted)",
                            border: "1px solid var(--border)",
                          }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message preview */}
            <div
              className="mb-3 rounded-xl p-3 text-sm leading-relaxed"
              style={{
                background: "rgba(37,211,102,0.05)",
                border: "1px solid rgba(37,211,102,0.15)",
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
        </div>
      )}
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="py-12 text-center">
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(61,139,110,0.12) 0%, rgba(45,112,96,0.18) 100%)",
          border: "1px solid rgba(61,139,110,0.20)",
        }}
      >
        <RefreshCcw className="h-6 w-6" style={{ color: "#3d8b6e" }} />
      </div>
      <h3 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
        {BRING_BACK.emptyState.title}
      </h3>
      <p
        className="mx-auto mt-2 max-w-sm text-sm leading-6"
        style={{ color: "var(--muted)" }}
      >
        {BRING_BACK.emptyState.body}
      </p>
      <Link
        href={BRING_BACK.emptyState.ctaHref}
        className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{
          background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
        }}
      >
        <Users2 className="h-4 w-4" />
        {BRING_BACK.emptyState.cta}
      </Link>
    </div>
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
        <h3 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
          לקוחות שלא חזרו
        </h3>
        {clients.length > 0 && (
          <span
            className="rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums"
            style={{ background: "rgba(184,107,140,0.10)", color: "#b86b8c" }}
          >
            {clients.length}
          </span>
        )}
      </div>

      {/* Client list or empty state */}
      {clients.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2.5">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} businessName={businessName} />
          ))}
        </div>
      )}
    </div>
  );
}
