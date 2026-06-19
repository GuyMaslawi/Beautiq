"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Clock, MessageCircle, CalendarCheck, UserCheck, Trash2 } from "lucide-react";
import { setWaitlistStatusAction } from "@/server/waitlist/actions";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { WAITLIST } from "@/lib/constants/he";
import type { WaitlistEntryItem } from "@/server/waitlist/queries";

const TZ = "Asia/Jerusalem";

const STATUS_STYLE: Record<
  WaitlistEntryItem["status"],
  { bg: string; color: string }
> = {
  active: { bg: "rgba(184,150,10,0.10)", color: "#7a6400" },
  notified: { bg: "rgba(59,122,181,0.10)", color: "#2a5a8a" },
  booked: { bg: "rgba(61,139,110,0.10)", color: "#2a6e57" },
  cancelled: { bg: "rgba(107,114,128,0.10)", color: "#4b5563" },
  expired: { bg: "rgba(107,114,128,0.10)", color: "#4b5563" },
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
  const style = STATUS_STYLE[entry.status];
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
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
        opacity: isTerminal ? 0.7 : 1,
      }}
    >
      <div className="flex items-center gap-3.5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{
            background:
              "linear-gradient(135deg, rgba(201,120,152,0.85) 0%, rgba(184,107,140,0.75) 100%)",
          }}
        >
          {getInitial(entry.clientName)}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/clients/${entry.clientId}`}
            className="text-sm font-bold transition-opacity hover:opacity-70"
            style={{ color: "var(--foreground)" }}
          >
            {entry.clientName}
          </Link>
          <p className="mt-0.5 truncate text-xs" style={{ color: "var(--muted)" }}>
            {entry.serviceName ?? WAITLIST.list.anyService}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ background: style.bg, color: style.color }}
        >
          {WAITLIST.status[entry.status]}
        </span>
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
      <div
        className="rounded-2xl px-5 py-12 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: "rgba(184,107,140,0.10)" }}
        >
          <Clock className="h-6 w-6" style={{ color: "#b86b8c" }} />
        </div>
        <p className="text-base font-bold" style={{ color: "var(--foreground)" }}>
          {WAITLIST.list.empty}
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm" style={{ color: "var(--muted)" }}>
          {WAITLIST.list.emptyHint}
        </p>
      </div>
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
