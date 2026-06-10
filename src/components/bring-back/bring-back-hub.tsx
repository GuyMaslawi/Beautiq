"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  RefreshCcw,
  MessageCircle,
  Copy,
  Check,
  CalendarDays,
  Users2,
  ChevronDown,
  ChevronUp,
  Info,
  User,
} from "lucide-react";
import { BRING_BACK } from "@/lib/constants/he";
import type { ClientSegment, BringBackSummary } from "@/server/bring-back/queries";
import {
  MIN_RETURN_WINDOW_DAYS,
  MAX_RETURN_WINDOW_DAYS,
} from "@/server/bring-back/queries";

// ── Serialised client shape (no Date objects across server/client boundary) ──

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

// ── Offer options ─────────────────────────────────────────────────────────────

const OFFER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: BRING_BACK.message.offers.none },
  { value: "מגיעה לך הנחה של 10% בתור הבא 🎁", label: BRING_BACK.message.offers.discount10 },
  { value: "שדרוג טיפול מתנה בתור הקרוב 🌟", label: BRING_BACK.message.offers.upgrade },
  { value: "יש לנו תור פנוי מיוחד בשבוע הקרוב — רק בשבילך 🗓️", label: BRING_BACK.message.offers.specialSlot },
];

// ── Preset threshold options ──────────────────────────────────────────────────

const PRESET_DAYS = [30, 45, 60, 90];

// ── Segment metadata ──────────────────────────────────────────────────────────

const SEGMENT_META: Record<
  ClientSegment,
  { color: string; bg: string; border: string; dot: string }
> = {
  critical: {
    color: "#8b3333",
    bg: "rgba(190,74,74,0.07)",
    border: "rgba(190,74,74,0.20)",
    dot: "#be4a4a",
  },
  high: {
    color: "#7a5800",
    bg: "rgba(184,150,10,0.07)",
    border: "rgba(184,150,10,0.22)",
    dot: "#c09040",
  },
  medium: {
    color: "#2a5a8a",
    bg: "rgba(59,122,181,0.07)",
    border: "rgba(59,122,181,0.20)",
    dot: "#3b7ab5",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

function formatHebrewDate(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getDate()} ב${HEBREW_MONTHS[d.getMonth()]}`;
}

function getInitial(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? "?";
}

function formatILS(amount: number): string {
  return `₪${Math.round(amount).toLocaleString("he-IL")}`;
}

// ── ExplanationBanner ─────────────────────────────────────────────────────────

function ExplanationBanner({ thresholdDays }: { thresholdDays: number }) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3.5"
      style={{
        background: "rgba(184,107,140,0.06)",
        border: "1px solid rgba(184,107,140,0.18)",
      }}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#b86b8c" }} />
      <p className="text-sm leading-6" style={{ color: "var(--foreground)" }}>
        {BRING_BACK.explanationBanner(thresholdDays)}
      </p>
    </div>
  );
}

// ── ThresholdSelector ─────────────────────────────────────────────────────────

function ThresholdSelector({ current }: { current: number }) {
  const isPreset = PRESET_DAYS.includes(current);
  const [customMode, setCustomMode] = useState(!isPreset);
  const [customValue, setCustomValue] = useState(current);
  const router = useRouter();

  const applyDays = (days: number) => {
    const clamped = Math.max(MIN_RETURN_WINDOW_DAYS, Math.min(MAX_RETURN_WINDOW_DAYS, days));
    router.push(`/bring-back?days=${clamped}`);
  };

  return (
    <div
      className="rounded-2xl px-5 py-4 space-y-3"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
        {BRING_BACK.thresholdLabel}
      </p>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        {PRESET_DAYS.map((days) => (
          <button
            key={days}
            onClick={() => { setCustomMode(false); applyDays(days); }}
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
            style={
              current === days && !customMode
                ? {
                    background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
                    color: "#fff",
                  }
                : {
                    background: "var(--background-alt)",
                    color: "var(--muted)",
                    border: "1px solid var(--border)",
                  }
            }
          >
            {days} {BRING_BACK.thresholdUnit}
          </button>
        ))}

        {/* Custom option */}
        <button
          onClick={() => setCustomMode(true)}
          className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
          style={
            customMode
              ? {
                  background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
                  color: "#fff",
                }
              : {
                  background: "var(--background-alt)",
                  color: "var(--muted)",
                  border: "1px solid var(--border)",
                }
          }
        >
          {BRING_BACK.thresholdCustom}
        </button>
      </div>

      {/* Custom input */}
      {customMode && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={customValue}
            min={MIN_RETURN_WINDOW_DAYS}
            max={MAX_RETURN_WINDOW_DAYS}
            onChange={(e) => setCustomValue(Number(e.target.value))}
            className="w-20 rounded-lg border px-2 py-1.5 text-center text-sm font-bold tabular-nums"
            style={{
              border: "1px solid var(--border)",
              background: "var(--background)",
              color: "var(--foreground)",
            }}
          />
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            {BRING_BACK.thresholdUnit}
          </span>
          <button
            onClick={() => applyDays(customValue)}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
            }}
          >
            {BRING_BACK.thresholdApply}
          </button>
        </div>
      )}

      {/* Helper text */}
      <p className="text-xs leading-5" style={{ color: "var(--muted)" }}>
        {BRING_BACK.thresholdHelperText}
      </p>
    </div>
  );
}

// ── SummaryRow ────────────────────────────────────────────────────────────────

function SummaryRow({ summary }: { summary: BringBackSummary }) {
  const pills = [
    { count: summary.total, label: BRING_BACK.summary.total, color: "#b86b8c", bg: "rgba(184,107,140,0.10)" },
    { count: summary.critical, label: BRING_BACK.summary.critical, color: "#be4a4a", bg: "rgba(190,74,74,0.10)" },
    { count: summary.high, label: BRING_BACK.summary.high, color: "#c09040", bg: "rgba(184,150,10,0.10)" },
    { count: summary.medium, label: BRING_BACK.summary.medium, color: "#3b7ab5", bg: "rgba(59,122,181,0.10)" },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {pills.map((p) => (
        <div
          key={p.label}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5"
          style={{ background: p.bg }}
        >
          <span className="text-xl font-bold tabular-nums" style={{ color: p.color }}>
            {p.count}
          </span>
          <span className="text-sm font-medium" style={{ color: p.color, opacity: 0.80 }}>
            {p.label}
          </span>
        </div>
      ))}
    </div>
  );
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

  const meta = SEGMENT_META[client.segment];

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
      // fallback — textarea is visible so user can copy manually
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="overflow-hidden rounded-2xl transition-shadow"
      style={{
        background: "var(--surface)",
        border: `1px solid var(--border)`,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Card header */}
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

        {/* Name + details */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
              {client.fullName}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
            >
              {BRING_BACK.card.daysAgo(client.daysSinceLastVisit)}
            </span>
          </div>
          {/* Meta line 1: service + last visit date */}
          <p className="mt-0.5 truncate text-xs" style={{ color: "var(--muted)" }}>
            {client.lastServiceName}
            <span className="mx-1.5" style={{ color: "var(--border)" }}>·</span>
            {BRING_BACK.card.lastVisit}: {formatHebrewDate(client.lastVisitAtISO)}
          </p>
          {/* Meta line 2: phone + visits + revenue */}
          <p className="mt-0.5 truncate text-xs" style={{ color: "var(--muted)" }}>
            {client.phone}
            <span className="mx-1.5" style={{ color: "var(--border)" }}>·</span>
            {client.totalCompletedBookings} {BRING_BACK.card.totalVisits}
            <span className="mx-1.5" style={{ color: "var(--border)" }}>·</span>
            {formatILS(client.totalRevenue)}
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
              {BRING_BACK.card.newBooking}
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
            <span>{expanded ? BRING_BACK.card.closeMessage : BRING_BACK.card.prepareMessage}</span>
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
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

            {/* WhatsApp send button */}
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

// ── SegmentSection ────────────────────────────────────────────────────────────

function SegmentSection({
  segment,
  clients,
  businessName,
}: {
  segment: ClientSegment;
  clients: BringBackClientSerialized[];
  businessName: string;
}) {
  if (clients.length === 0) return null;

  const meta = SEGMENT_META[segment];
  const info = BRING_BACK.segments[segment];

  return (
    <div>
      {/* Section header */}
      <div className="mb-3 space-y-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: meta.dot }}
          />
          <h3 className="text-sm font-bold" style={{ color: meta.color }}>
            {info.label}
          </h3>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: meta.bg, color: meta.color }}
          >
            {info.days}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{
              background: "var(--background-alt)",
              color: "var(--muted)",
              border: "1px solid var(--border)",
            }}
          >
            {clients.length} לקוחות
          </span>
        </div>
        <p className="text-xs pr-5" style={{ color: "var(--muted)" }}>
          {info.description}
        </p>
      </div>

      {/* Client cards */}
      <div className="space-y-2.5">
        {clients.map((client) => (
          <ClientCard key={client.id} client={client} businessName={businessName} />
        ))}
      </div>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="py-16 text-center">
      <div
        className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(61,139,110,0.12) 0%, rgba(45,112,96,0.18) 100%)",
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
        className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
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

export function BringBackHub({
  clients,
  summary,
  thresholdDays,
  businessName,
}: BringBackHubProps) {
  const criticalClients = clients.filter((c) => c.segment === "critical");
  const highClients = clients.filter((c) => c.segment === "high");
  const mediumClients = clients.filter((c) => c.segment === "medium");

  return (
    <div className="space-y-6">
      {/* Explanation banner */}
      <ExplanationBanner thresholdDays={thresholdDays} />

      {/* Threshold selector */}
      <ThresholdSelector current={thresholdDays} />

      {/* Summary row */}
      {summary.total > 0 && <SummaryRow summary={summary} />}

      {/* Client segments or empty state */}
      {clients.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          <SegmentSection
            segment="critical"
            clients={criticalClients}
            businessName={businessName}
          />
          <SegmentSection
            segment="high"
            clients={highClients}
            businessName={businessName}
          />
          <SegmentSection
            segment="medium"
            clients={mediumClients}
            businessName={businessName}
          />
        </div>
      )}
    </div>
  );
}
