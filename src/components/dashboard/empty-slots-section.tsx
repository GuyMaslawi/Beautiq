"use client";

import { useState } from "react";
import { Clock, MessageCircle, ChevronDown, ChevronUp, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EMPTY_SLOTS, AVAILABILITY } from "@/lib/constants/he";
import type { EmptySlot } from "@/lib/empty-slots/find-empty-slots";
import type { SuggestedClient } from "@/server/empty-slots/queries";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function formatDurationHebrew(minutes: number): string {
  if (minutes < 60) return `${minutes} דקות`;
  if (minutes === 60) return "שעה";
  if (minutes === 90) return "שעה וחצי";
  if (minutes === 120) return "שעתיים";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} שעות`;
  if (mins === 30) return `${hours} שעות וחצי`;
  return `${hours} שעות ו־${mins} דקות`;
}

function formatSlotDateHebrew(dateStr: string, weekday: number): string {
  const dayName = AVAILABILITY.days[weekday];
  const [year, month, day] = dateStr.split("-").map(Number);
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12));
  const monthStr = noonUTC.toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    month: "long",
  });
  return `יום ${dayName}, ${day} ב${monthStr}`;
}

function buildMessage(slot: EmptySlot, clientName?: string): string {
  const dateDisplay = formatSlotDateHebrew(slot.date, slot.weekday);
  const start = minutesToHHMM(slot.startMinutes);
  const end = minutesToHHMM(slot.endMinutes);
  if (clientName) {
    return `היי ${clientName}, התפנה לי תור ${dateDisplay} בין ${start} ל־${end}.\nאם מתאים לך, אשמח לשמור לך את המועד ❤️`;
  }
  return `היי, התפנה תור ${dateDisplay} בין ${start} ל־${end}.\nאפשר לשלוח הודעה אם תרצי לקבוע.`;
}

// ---------------------------------------------------------------------------
// Single slot card
// ---------------------------------------------------------------------------

function EmptySlotCard({
  slot,
  suggestedClients,
}: {
  slot: EmptySlot;
  suggestedClients: SuggestedClient[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedClient = suggestedClients.find((c) => c.id === selectedClientId);
  const message = buildMessage(slot, selectedClient?.fullName);
  const startTime = minutesToHHMM(slot.startMinutes);
  const endTime = minutesToHHMM(slot.endMinutes);
  const dateLabel = formatSlotDateHebrew(slot.date, slot.weekday);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // silent fail — clipboard not available in some contexts
    }
  }

  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{
        background: "#fff",
        borderColor: "rgba(184,107,140,0.18)",
        boxShadow: "0 1px 4px rgba(43,37,48,0.05)",
      }}
    >
      {/* Slot header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <p className="text-foreground font-semibold text-sm">{dateLabel}</p>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: "#b86b8c" }} />
            <p className="text-muted text-xs">
              {startTime}–{endTime}
            </p>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ background: "rgba(184,107,140,0.10)", color: "#b86b8c" }}
        >
          {EMPTY_SLOTS.freeWindow} · {formatDurationHebrew(slot.durationMinutes)}
        </span>
      </div>

      {/* Prepare message toggle */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-80"
        style={{ color: "#b86b8c" }}
      >
        <MessageCircle className="h-4 w-4" />
        {EMPTY_SLOTS.prepareMessage}
        {isExpanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Expanded message panel */}
      {isExpanded && (
        <div
          className="space-y-3 pt-3 border-t"
          style={{ borderColor: "rgba(43,37,48,0.08)" }}
        >
          {/* Client selection */}
          {suggestedClients.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium" style={{ color: "#8a8190" }}>
                {EMPTY_SLOTS.suggestedClients}
              </p>
              <div className="flex flex-wrap gap-2">
                {/* Generic option */}
                <button
                  onClick={() => setSelectedClientId(null)}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                  style={
                    selectedClientId === null
                      ? { background: "#b86b8c", color: "#fff" }
                      : { background: "rgba(43,37,48,0.06)", color: "#8a8190" }
                  }
                >
                  {EMPTY_SLOTS.genericMessage}
                </button>
                {suggestedClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() =>
                      setSelectedClientId(
                        client.id === selectedClientId ? null : client.id,
                      )
                    }
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors"
                    style={
                      selectedClientId === client.id
                        ? { background: "#b86b8c", color: "#fff" }
                        : { background: "rgba(43,37,48,0.06)", color: "#2b2530" }
                    }
                  >
                    <User className="h-3 w-3" />
                    {client.fullName}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs leading-5" style={{ color: "#8a8190" }}>
              {EMPTY_SLOTS.noSuggestedClients}
            </p>
          )}

          {/* Message preview */}
          <div
            className="rounded-xl p-3 text-sm leading-relaxed whitespace-pre-line"
            style={{ background: "rgba(43,37,48,0.04)", color: "#2b2530" }}
            dir="rtl"
          >
            {message}
          </div>

          {/* Copy button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            className="w-full"
          >
            {copied
              ? `✓ ${EMPTY_SLOTS.copiedSuccess}`
              : EMPTY_SLOTS.copyButton}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section container
// ---------------------------------------------------------------------------

export interface EmptySlotsSectionProps {
  slots: EmptySlot[];
  suggestedClients: SuggestedClient[];
  hasServicesAndAvailability: boolean;
}

export function EmptySlotsSection({
  slots,
  suggestedClients,
  hasServicesAndAvailability,
}: EmptySlotsSectionProps) {
  if (!hasServicesAndAvailability) return null;

  return (
    <section id="empty-slots" className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="h-4.5 w-4.5 shrink-0" style={{ color: "#b86b8c" }} />
        <div>
          <h2 className="text-foreground font-bold">
            {EMPTY_SLOTS.sectionTitle}
          </h2>
        </div>
      </div>
      <p className="text-muted text-xs leading-5 -mt-2">
        {EMPTY_SLOTS.sectionSubtitle}
      </p>

      {slots.length === 0 ? (
        <div
          className="rounded-2xl border p-5 space-y-1"
          style={{
            borderColor: "rgba(61,139,110,0.2)",
            background: "rgba(61,139,110,0.05)",
          }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: "#3d8b6e" }}
          >
            {EMPTY_SLOTS.noSlots}
          </p>
          <p className="text-muted text-xs">{EMPTY_SLOTS.noSlotsSubtitle}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {slots.map((slot, i) => (
            <EmptySlotCard
              key={`${slot.date}-${slot.startMinutes}-${i}`}
              slot={slot}
              suggestedClients={suggestedClients}
            />
          ))}
        </div>
      )}
    </section>
  );
}
