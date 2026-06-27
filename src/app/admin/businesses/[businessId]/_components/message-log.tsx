import type {
  AdminMessageLog,
  AdminMessageLogEntry,
  MessageOutcome,
} from "@/server/admin/message-log";

const OUTCOME_META: Record<MessageOutcome, { label: string; color: string; bg: string }> = {
  sent: { label: "נשלח ל-Meta", color: "#2563eb", bg: "rgba(37,99,235,0.10)" },
  delivered: { label: "נמסר", color: "#16a34a", bg: "rgba(22,163,74,0.10)" },
  read: { label: "נקרא", color: "#16a34a", bg: "rgba(22,163,74,0.10)" },
  queued: { label: "ממתין", color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
  failed: { label: "נכשל (שגיאת ספק)", color: "#dc2626", bg: "rgba(220,38,38,0.10)" },
  test_mode_blocked: { label: "נחסם — מצב בדיקה", color: "#b45309", bg: "rgba(180,83,9,0.10)" },
  awaiting_confirmation: { label: "נחסם — ממתין לאישור המספר", color: "#b45309", bg: "rgba(180,83,9,0.10)" },
  invalid_phone: { label: "מספר לא תקין", color: "#dc2626", bg: "rgba(220,38,38,0.10)" },
  missing_template: { label: "חסרה תבנית", color: "#b45309", bg: "rgba(180,83,9,0.10)" },
  opted_out: { label: "הסרה מרשימה", color: "#9ca3af", bg: "rgba(156,163,175,0.12)" },
  dev_mock: { label: "מצב פיתוח", color: "#9ca3af", bg: "rgba(156,163,175,0.12)" },
  skipped: { label: "דולג", color: "#9ca3af", bg: "rgba(156,163,175,0.12)" },
};

const TYPE_LABEL: Record<string, string> = {
  win_back: "החזרת לקוחות",
  morning_reminder: "תזכורת לתור",
  review_request: "בקשת ביקורת",
  booking_confirmation: "אישור תור",
  manual: "ידני/בדיקה",
};

const SOURCE_LABEL: Record<string, string> = {
  cron: "אוטומציה",
  manual_owner: "בעל עסק",
  manual_admin: "אדמין",
  retry: "ניסיון חוזר",
};

function OutcomeBadge({ outcome }: { outcome: MessageOutcome }) {
  const meta = OUTCOME_META[outcome];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

function LogRow({ msg }: { msg: AdminMessageLogEntry }) {
  return (
    <div
      className="rounded-xl p-3 text-xs space-y-1.5"
      style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold" style={{ color: "#1a1a2e" }}>
          {msg.clientName}
        </span>
        <OutcomeBadge outcome={msg.outcome} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ color: "#6b7280" }}>
        <span>
          {new Date(msg.createdAt).toLocaleString("he-IL", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span>סוג: {TYPE_LABEL[msg.type] ?? msg.type}</span>
        <span>מקור: {msg.source ? SOURCE_LABEL[msg.source] ?? msg.source : "—"}</span>
        <span dir="ltr">נמען: {msg.maskedPhone}</span>
        {msg.retryCount > 0 && <span>ניסיונות: {msg.retryCount + 1}</span>}
      </div>
      {msg.providerMessageId && (
        <div style={{ color: "#2563eb" }} dir="ltr">
          מזהה Meta: {msg.providerMessageId}
        </div>
      )}
      {msg.failureReason && (
        <div style={{ color: "#b45309" }}>סיבה: {msg.failureReason}</div>
      )}
      {msg.metaError ? (
        <div
          className="mt-1 rounded-lg p-2 space-y-0.5"
          style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)" }}
          dir="ltr"
        >
          <div className="font-semibold" style={{ color: "#dc2626" }} dir="rtl">
            פרטי שגיאת Meta
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: "#6b7280" }}>
            {msg.metaError.code !== null && <span>code: {msg.metaError.code}</span>}
            {msg.metaError.subcode !== null && <span>subcode: {msg.metaError.subcode}</span>}
            {msg.metaError.type && <span>type: {msg.metaError.type}</span>}
            {msg.metaError.fbtraceId && <span>fbtrace_id: {msg.metaError.fbtraceId}</span>}
          </div>
          {(msg.phoneNumberId || msg.templateId || msg.templateLanguage) && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: "#6b7280" }}>
              {msg.phoneNumberId && <span>phone_number_id: {msg.phoneNumberId}</span>}
              {msg.templateId && <span>template: {msg.templateId}</span>}
              {msg.templateLanguage && <span>lang: {msg.templateLanguage}</span>}
            </div>
          )}
          {msg.metaError.raw && (
            <details>
              <summary className="cursor-pointer" style={{ color: "#6b7280" }} dir="rtl">
                Meta raw (sanitized)
              </summary>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-[10px]" style={{ color: "#6b7280" }}>
                {msg.metaError.raw}
              </pre>
            </details>
          )}
        </div>
      ) : (
        (msg.phoneNumberId || msg.templateId || msg.templateLanguage) && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]" style={{ color: "#9ca3af" }} dir="ltr">
            {msg.phoneNumberId && <span>phone_number_id: {msg.phoneNumberId}</span>}
            {msg.templateId && <span>template: {msg.templateId}</span>}
            {msg.templateLanguage && <span>lang: {msg.templateLanguage}</span>}
          </div>
        )
      )}
    </div>
  );
}

/** Compact count chip used in the summary strip — hidden when zero. */
function SummaryChip({ outcome, count }: { outcome: MessageOutcome; count: number }) {
  if (count === 0) return null;
  const meta = OUTCOME_META[outcome];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: meta.bg, color: meta.color }}
    >
      <span className="font-bold">{count}</span>
      {meta.label}
    </span>
  );
}

const SUMMARY_ORDER: MessageOutcome[] = [
  "delivered",
  "read",
  "sent",
  "queued",
  "failed",
  "test_mode_blocked",
  "awaiting_confirmation",
  "invalid_phone",
  "missing_template",
  "opted_out",
  "dev_mock",
  "skipped",
];

export function AdminMessageLogPanel({ log }: { log: AdminMessageLog }) {
  return (
    <div>
      {log.total === 0 ? (
        <p className="text-sm" style={{ color: "#9ca3af" }}>
          עדיין לא נשלחו הודעות WhatsApp עבור עסק זה.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {SUMMARY_ORDER.map((o) => (
              <SummaryChip key={o} outcome={o} count={log.summary[o]} />
            ))}
          </div>
          <div className="space-y-3">
            {log.entries.map((msg) => (
              <LogRow key={msg.id} msg={msg} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
