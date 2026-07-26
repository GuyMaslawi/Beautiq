/**
 * אימות כתובות URL שבעלת העסק מזינה (לוגו, תמונת רקע, גלריה, קישורי רשתות).
 *
 * הכתובות האלו נשמרות במסד ומוצגות בעמוד הציבורי — ב-src ושל תמונות
 * וב-href של קישורים. בלי אימות סכימה (scheme) אפשר לשמור `javascript:` או
 * `data:` ולהפוך את הקישור לווקטור הרצת קוד ברגע שהשדה יעבור לרינדור אחר,
 * וכן לשמור מסמכי data: ענקיים בעמודה של המסד.
 *
 * הכלל: https בלבד, עם תקרת אורך. הפונקציות מחזירות null כשהכתובת אינה
 * תקינה, כך שהקורא יכול להחזיר שגיאה או לשמור null.
 */

const MAX_URL_LENGTH = 2048;

/**
 * מאמת כתובת https מוחלטת. מקבל גם כתובת בלי סכימה ומשלים ל-https,
 * אך דוחה כל סכימה אחרת (בפרט javascript: ו-data:).
 */
export function validateHttpsUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;

  // חשוב לדחות במפורש לפני ההשלמה: בלי זה `javascript:alert(1)` היה מקבל
  // קידומת ומתחזה לכתובת תקינה במקום להיפסל.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  // פוסל צורות כמו "https:////evil" שהדפדפן מנרמל לדומיין זר.
  if (!url.hostname || !url.hostname.includes(".")) return null;

  return url.toString();
}

/** זהה לאימות https, ומיועד לשדות תמונה (לוגו / רקע / גלריה). */
export function validateImageUrl(raw: string): string | null {
  return validateHttpsUrl(raw);
}

/**
 * שדות רשתות חברתיות: מקבל גם קיצור של שם משתמש (למשל `@noa` או `noa`),
 * שהעמוד הציבורי משלים לכתובת מלאה. כל דבר שנראה כמו כתובת חייב להיות https —
 * כך `javascript:` נפסל במקום לקבל קידומת ולהתחזה לכתובת תקינה.
 */
export function validateSocialField(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;

  // שם משתמש בלבד — בלי סכימה ובלי נתיב.
  if (!/[:/]/.test(trimmed)) return trimmed;

  return validateHttpsUrl(trimmed);
}
