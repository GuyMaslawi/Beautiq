import { Download, Trash2 } from "lucide-react";
import { SETTINGS } from "@/lib/constants/he";
import { SUPPORT_EMAIL } from "@/lib/config";

/**
 * "הנתונים שלך" — הורדת הנתונים ומסלול מחיקת החשבון.
 *
 * ההורדה היא קישור <a download> רגיל ולא כפתור עם JavaScript: הדפדפן מטפל
 * בקובץ בעצמו, כך שגם ייצוא של אלפי שורות לא צריך לעבור דרך זיכרון הדף.
 * לכן זה נשאר Server Component — אין כאן שום מצב (state).
 *
 * מחיקת החשבון היא בקשה במייל ולא כפתור: פעולה בלתי הפיכה שמוחקת את כל
 * הלקוחות וההיסטוריה של עסק אינה צריכה להיות במרחק קליק אחד ממסך ההגדרות.
 */
export function DataExportCard() {
  const t = SETTINGS.dataExport;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-[var(--muted)]">{t.body}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <ExportLink
          href="/api/account/export?type=clients"
          label={t.clientsButton}
          hint={t.clientsHint}
        />
        <ExportLink
          href="/api/account/export?type=bookings"
          label={t.bookingsButton}
          hint={t.bookingsHint}
        />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
          <Trash2 className="h-3.5 w-3.5 text-[var(--muted)]" />
          {t.deleteTitle}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
          {t.deleteBody}
        </p>
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("בקשת מחיקת חשבון")}`}
          className="mt-2.5 inline-block text-xs font-medium text-[var(--primary)] hover:underline"
        >
          {t.deleteButton}
        </a>
      </div>
    </div>
  );
}

function ExportLink({
  href,
  label,
  hint,
}: {
  href: string;
  label: string;
  hint: string;
}) {
  return (
    <a
      href={href}
      download
      className="bg-surface flex items-start gap-3 rounded-xl border border-[var(--border)] px-4 py-3 transition-colors hover:bg-[var(--background)]"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10">
        <Download className="h-4 w-4 text-[var(--primary)]" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--foreground)]">
          {label}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-[var(--muted)]">
          {hint}
        </span>
      </span>
    </a>
  );
}
