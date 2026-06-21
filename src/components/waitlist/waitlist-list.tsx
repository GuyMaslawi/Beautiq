"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Clock, MessageCircle, CalendarCheck, UserCheck, Trash2 } from "lucide-react";
import { setWaitlistStatusAction } from "@/server/waitlist/actions";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { WAITLIST } from "@/lib/constants/he";
import type { WaitlistEntryItem } from "@/server/waitlist/queries";
import { LuxuryStatusPill } from "@/components/premium/status-pill";
import { PremiumEmptyState } from "@/components/premium/empty-state";
import type { ToneKey } from "@/components/premium/tokens";

const TZ = "Asia/Jerusalem";

const STATUS_TONE: Record<WaitlistEntryItem["status"], ToneKey> = {
  active: "warning",
  notified: "info",
  booked: "success",
  cancelled: "neutral",
  expired: "neutral",
};

function timeOfDay(d: Date): string {
  return new Date(d).toLocaleTimeString("he-IL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatPreferred(from: Date | null, to: Date | null): string {
  if (!from) return WAITLIST.list.anyTime;
  const dateStr = new Date(from).toLocaleDateString("he-IL", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
  });
  const fromT = timeOfDay(from);
  const toT = to ? timeOfDay(to) : null;
  // 00:00–23:59 means "any time that day" — show just the date.
  if (fromT === "00:00" && (toT === null || toT === "23:59")) return dateStr;
  return toT ? `${dateStr} · ${fromT}–${toT}` : `${dateStr} · ${fromT}`;
}

function formatAdded(d: Date): string {
  return new Date(d).toLocaleDateString("he-IL", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
  });
}

function getInitial(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? "?";
}

function Row({ entry }: { entry: WaitlistEntryItem }) {
  const [pending, startTransition] = useTransition();
  const isTerminal =
    entry.status === "booked" ||
    entry.status === "cancelled" ||
    entry.status === "expired";

  const waUrl = buildWhatsAppUrl(
    entry.clientPhone,
    WAITLIST.list.buildMessage(entry.clientName, entry.serviceName),
  );

  const setStatus = (status: WaitlistEntryItem["status"]) =>
    startTransition(() => {
      void setWaitlistStatusAction(entry.id, status);
    });

  return (
    <div
      className="lift space-y-3 rounded-[1.35rem] p-4"
      style={{
        background: "linear-gradient(170deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.82) 100%)",
        border: "1px solid rgba(184,107,140,0.14)",
        boxShadow: "0 6px 20px -10px rgba(124,58,97,0.16), inset 0 1px 0 rgba(255,255,255,0.9)",
        opacity: isTerminal ? 0.65 : 1,
      }}
    >
      <div className="flex items-center gap-3.5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg,#c97898,#9d6aa8)", boxShadow: "0 6px 16px -6px rgba(184,107,140,0.55)" }}
        >
          {getInitial(entry.clientName)}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/clients/${entry.clientId}`}
            className="text-foreground text-sm font-bold transition-opacity hover:opacity-70"
          >
            {entry.clientName}
          </Link>
          <p className="mt-0.5 truncate text-xs" style={{ color: "var(--muted)" }}>
            {entry.serviceName ?? WAITLIST.list.anyService}
          </p>
        </div>
        <LuxuryStatusPill tone={STATUS_TONE[entry.status]} dot={entry.status === "active"}>
          {WAITLIST.status[entry.status]}
        </LuxuryStatusPill>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "var(--muted)" }}>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {formatPreferred(entry.preferredFrom, entry.preferredTo)}
        </span>
        <span>{WAITLIST.list.columnAdded}: {formatAdded(entry.createdAt)}</span>
      </div>

      {entry.notes && (
        <p className="text-xs leading-relaxed" style={{ color: "var(--foreground-soft)" }}>
          {entry.notes}
        </p>
      )}

      {!isTerminal && (
        <div className="flex flex-wrap gap-2 pt-1">
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: "rgba(37,211,102,0.10)", color: "#1a9e4e", border: "1px solid rgba(37,211,102,0.20)" }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {WAITLIST.actions.sendMessage}
            </a>
          )}
          {entry.status === "active" && (
            <button
              onClick={() => setStatus("notified")}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
              style={{ background: "rgba(59,122,181,0.08)", color: "#2a5a8a", border: "1px solid rgba(59,122,181,0.20)" }}
            >
              <UserCheck className="h-3.5 w-3.5" />
              {WAITLIST.actions.markContacted}
            </button>
          )}
          <button
            onClick={() => setStatus("booked")}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            style={{ background: "rgba(61,139,110,0.08)", color: "#2a6e57", border: "1px solid rgba(61,139,110,0.20)" }}
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            {WAITLIST.actions.markBooked}
          </button>
          <button
            onClick={() => setStatus("cancelled")}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            style={{ background: "rgba(107,114,128,0.07)", color: "#4b5563", border: "1px solid rgba(107,114,128,0.18)" }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {WAITLIST.actions.remove}
          </button>
        </div>
      )}
    </div>
  );
}

export function WaitlistList({ entries }: { entries: WaitlistEntryItem[] }) {
  if (entries.length === 0) {
    return (
      <PremiumEmptyState
        tint="blush"
        title={WAITLIST.list.empty}
        body={WAITLIST.list.emptyHint}
        icon={<Clock className="h-7 w-7" />}
        orbit={[
          <CalendarCheck key="a" className="h-4 w-4" />,
          <UserCheck key="b" className="h-4 w-4" />,
          <MessageCircle key="c" className="h-4 w-4" />,
        ]}
      />
    );
  }

  return (
    <div className="space-y-3" dir="rtl">
      {entries.map((entry) => (
        <Row key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
