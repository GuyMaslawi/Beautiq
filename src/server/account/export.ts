/**
 * ייצוא הנתונים של בעלת העסק לקובץ CSV.
 *
 * שני תפקידים, ושניהם נדרשים כדי להיות מוצר אמיתי ולא כלוב:
 *
 * 1. **שליטה על הנתונים.** מדיניות הפרטיות ותנאי השימוש מבטיחים זכות עיון
 *    וניידות. עד עכשיו הייתה למערכת דלת כניסה אחת (ייבוא לקוחות) ואף דלת
 *    יציאה — הבטחה משפטית בלי מימוש.
 * 2. **גיבוי אישי.** בעלת עסק שרוצה עותק משלה לפני שינוי גדול, או לפני
 *    ביטול מנוי, לא צריכה לבקש אותו מאיתנו.
 *
 * כל שאילתה כאן מסוננת ב-businessId (CLAUDE.md §10) — קובץ ייצוא שדולף שורה
 * אחת של עסק אחר הוא הדליפה הגרועה ביותר שיש למוצר רב-דיירים.
 */

import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import { toCsv } from "@/lib/csv";
import { BOOKING_STATUS } from "@/lib/constants/he";

const TZ = "Asia/Jerusalem";

/** מקור התור בעברית — לקובץ שבעלת העסק פותחת ב-Excel. */
const BOOKING_SOURCE_LABELS: Record<string, string> = {
  public: "דף ההזמנות",
  manual: "הוזן ידנית",
  waitlist: "רשימת המתנה",
};

/** סוגי הייצוא הנתמכים. */
export const EXPORT_TYPES = ["clients", "bookings"] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

export function isExportType(value: string | null): value is ExportType {
  return value !== null && (EXPORT_TYPES as readonly string[]).includes(value);
}

/** "29/07/2026" בשעון ישראל — הפורמט שבעלת העסק מכירה. */
function formatDate(value: Date | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

/** "14:30" בשעון ישראל. */
function formatTime(value: Date | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

function formatBoolean(value: boolean): string {
  return value ? "כן" : "לא";
}

export interface CsvExport {
  /** תוכן הקובץ. */
  content: string;
  /** בסיס שם הקובץ, ללא סיומת. */
  fileNameBase: string;
  /** מספר שורות הנתונים (ללא הכותרת) — לתיעוד ולבדיקות. */
  rowCount: number;
}

/** כל הלקוחות של העסק, כולל היסטוריה מצטברת וסטטוס הסכמה להודעות. */
export async function exportClientsCsv(tenant: TenantContext): Promise<CsvExport> {
  const clients = await prisma.client.findMany({
    where: { businessId: tenant.businessId },
    orderBy: { fullName: "asc" },
    select: {
      fullName: true,
      phone: true,
      email: true,
      notes: true,
      totalBookings: true,
      noShowCount: true,
      cancellationCount: true,
      totalSpent: true,
      lastVisitAt: true,
      whatsappOptIn: true,
      marketingOptIn: true,
      unsubscribedAt: true,
      createdAt: true,
    },
  });

  const headers = [
    "שם מלא",
    "טלפון",
    "אימייל",
    "הערות",
    "סה״כ תורים",
    "אי-הגעות",
    "ביטולים",
    "סה״כ הכנסות (₪)",
    "ביקור אחרון",
    "אישרה קבלת הודעות",
    "אישרה הודעות שיווקיות",
    "ביקשה להסיר",
    "נוספה בתאריך",
  ];

  const rows = clients.map((c) => [
    c.fullName,
    c.phone,
    c.email ?? "",
    c.notes ?? "",
    c.totalBookings,
    c.noShowCount,
    c.cancellationCount,
    c.totalSpent.toString(),
    formatDate(c.lastVisitAt),
    formatBoolean(c.whatsappOptIn),
    formatBoolean(c.marketingOptIn),
    formatBoolean(c.unsubscribedAt !== null),
    formatDate(c.createdAt),
  ]);

  return {
    content: toCsv(headers, rows),
    fileNameBase: "לקוחות",
    rowCount: rows.length,
  };
}

/** כל התורים של העסק — המחיר והמשך נלקחים מהתמונה שנשמרה בזמן הקביעה. */
export async function exportBookingsCsv(tenant: TenantContext): Promise<CsvExport> {
  const bookings = await prisma.booking.findMany({
    where: { businessId: tenant.businessId },
    orderBy: { startTime: "desc" },
    select: {
      startTime: true,
      endTime: true,
      status: true,
      source: true,
      priceSnapshot: true,
      durationMinutesSnapshot: true,
      notes: true,
      cancellationReason: true,
      createdAt: true,
      client: { select: { fullName: true, phone: true } },
      service: { select: { name: true } },
    },
  });

  const headers = [
    "תאריך",
    "שעת התחלה",
    "שעת סיום",
    "לקוחה",
    "טלפון",
    "שירות",
    "משך (דקות)",
    "מחיר (₪)",
    "סטטוס",
    "מקור",
    "הערות",
    "סיבת ביטול",
    "נקבע בתאריך",
  ];

  const rows = bookings.map((b) => [
    formatDate(b.startTime),
    formatTime(b.startTime),
    formatTime(b.endTime),
    b.client.fullName,
    b.client.phone,
    b.service.name,
    b.durationMinutesSnapshot,
    b.priceSnapshot.toString(),
    BOOKING_STATUS[b.status] ?? b.status,
    BOOKING_SOURCE_LABELS[b.source] ?? b.source,
    b.notes ?? "",
    b.cancellationReason ?? "",
    formatDate(b.createdAt),
  ]);

  return {
    content: toCsv(headers, rows),
    fileNameBase: "תורים",
    rowCount: rows.length,
  };
}

/** נקודת כניסה אחת לפי סוג הייצוא. */
export function buildExport(
  tenant: TenantContext,
  type: ExportType,
): Promise<CsvExport> {
  return type === "clients" ? exportClientsCsv(tenant) : exportBookingsCsv(tenant);
}
