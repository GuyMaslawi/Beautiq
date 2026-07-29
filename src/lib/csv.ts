/**
 * בניית קובצי CSV — ללא תלות חיצונית.
 *
 * שתי החלטות שאינן מובנות מאליהן, ושתיהן נובעות מכך שהיעד הוא Excel בעברית:
 *
 * 1. **BOM בתחילת הקובץ.** בלי סימן ה-BOM, Excel בווינדוס פותח את הקובץ
 *    בקידוד המקומי ולא ב-UTF-8, ובעלת העסק רואה ג'יבריש במקום שמות לקוחות.
 *    זה הופך "ייצוא נתונים" מפיצ'ר לבדיחה.
 *
 * 2. **בריחה (escaping) של תא שמתחיל ב-=,+,-,@.** תא כזה מתפרש ב-Excel
 *    כנוסחה (CSV injection). שם לקוחה או הערה שמתחילים ב"-" יריצו נוסחה
 *    במחשב של מי שפותח את הקובץ. מקדימים גרש כדי שהתא יישאר טקסט.
 */

/** תווים שהופכים תא ל"נוסחה" בעיני Excel / Google Sheets. */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

/** ממיר ערך בודד לתא CSV בטוח. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = String(value);

  if (text.length > 0 && FORMULA_PREFIXES.includes(text[0])) {
    text = `'${text}`;
  }

  // ציטוט נדרש כשיש פסיק, גרשיים או שורה חדשה; גרשיים פנימיים מוכפלים.
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * בונה מחרוזת CSV מלאה משורת כותרות ומשורות נתונים.
 *
 * CRLF ולא LF — זה מה שהתקן (RFC 4180) מגדיר, וזה מה ש-Excel מצפה לו.
 */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/**
 * שם קובץ בטוח להורדה.
 *
 * שם העסק בעברית מגיע מקלט חופשי ועלול להכיל מרכאות, פסיקים או שורה חדשה —
 * שכולם שוברים את כותרת Content-Disposition (ובמקרה הרע מאפשרים הזרקת
 * כותרת). לכן משאירים רק אותיות, ספרות, מקף וקו תחתון.
 */
export function safeFileName(base: string, extension: string): string {
  const cleaned = base
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${cleaned || "allura"}.${extension}`;
}
