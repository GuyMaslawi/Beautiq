"use client";

import { useState } from "react";
import Link from "next/link";
import { Users2, MessageCircle, Copy, Check, ChevronDown, ChevronUp, Star } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { WAITLIST } from "@/lib/constants/he";
import type { WaitlistCandidate } from "@/server/waitlist/queries";

interface SerializedCandidate {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  serviceName: string | null;
  isStrongMatch: boolean;
}

function CandidateCard({
  candidate,
  defaultMessage,
}: {
  candidate: SerializedCandidate;
  defaultMessage: string;
}) {
  const [message, setMessage] = useState(defaultMessage);
  const [copied, setCopied] = useState(false);

  const waUrl = buildWhatsAppUrl(candidate.clientPhone, message);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      // message stays visible for manual copy
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="rounded-xl p-3.5 space-y-2.5"
      style={{ background: "var(--background-alt)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2">
        <Link
          href={`/clients/${candidate.clientId}`}
          className="text-sm font-bold transition-opacity hover:opacity-70"
          style={{ color: "var(--foreground)" }}
        >
          {candidate.clientName}
        </Link>
        {candidate.isStrongMatch && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: "rgba(61,139,110,0.10)", color: "#2a6e57" }}
          >
            <Star className="h-3 w-3" />
            {WAITLIST.match.strongMatch}
          </span>
        )}
        <span className="ms-auto text-xs" style={{ color: "var(--muted)" }}>
          {candidate.serviceName ?? WAITLIST.list.anyService}
        </span>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        className="bg-surface border-border text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary"
        style={{ direction: "rtl" }}
      />

      <div className="flex flex-wrap gap-2">
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #25d366 0%, #1ab954 100%)" }}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {WAITLIST.actions.sendMessage}
          </a>
        )}
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          style={{ background: "var(--surface)", color: "var(--foreground-soft)", border: "1px solid var(--border)" }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? WAITLIST.actions.copied : WAITLIST.actions.copy}
        </button>
      </div>
    </div>
  );
}

/**
 * Shown on the booking detail page once a booking is cancelled: surfaces
 * waitlist clients who might want the freed slot. The owner stays in control —
 * nothing is sent automatically; each message can be edited before sending.
 */
export function WaitlistMatchPanel({
  candidates,
  bookingDate,
  bookingTime,
}: {
  candidates: WaitlistCandidate[];
  bookingDate: string;
  bookingTime: string;
}) {
  const [open, setOpen] = useState(false);
  if (candidates.length === 0) return null;

  const title =
    candidates.length === 1
      ? WAITLIST.match.titleSingular
      : WAITLIST.match.titlePlural(candidates.length);

  return (
    <div
      className="rounded-2xl p-5 space-y-3"
      style={{
        background: "linear-gradient(135deg, rgba(184,107,140,0.06) 0%, rgba(201,120,152,0.04) 100%)",
        border: "1px solid rgba(184,107,140,0.22)",
      }}
      dir="rtl"
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "rgba(184,107,140,0.12)" }}
        >
          <Users2 className="h-5 w-5" style={{ color: "#b86b8c" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            {title}
          </p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {WAITLIST.match.subtitle}
          </p>
        </div>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ color: "#b86b8c" }}
      >
        {open ? WAITLIST.match.hideCandidates : WAITLIST.match.viewCandidates}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="space-y-2.5 pt-1">
          {candidates.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={{
                id: c.id,
                clientId: c.clientId,
                clientName: c.clientName,
                clientPhone: c.clientPhone,
                serviceName: c.serviceName,
                isStrongMatch: c.isStrongMatch,
              }}
              defaultMessage={WAITLIST.match.buildMessage({
                clientName: c.clientName,
                serviceName: c.serviceName,
                date: bookingDate,
                time: bookingTime,
              })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
