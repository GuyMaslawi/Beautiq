// תצורה מרכזית לכתובות ולמותג.
// עד להשקה הסופית אנו משתמשים בדומיין קנוני אחד: https://allura.info
// בפרודקשן אפשר לדרוס את כתובת הבסיס דרך משתנה הסביבה NEXT_PUBLIC_APP_URL
// (חשוף לדפדפן — מתחיל ב-NEXT_PUBLIC_ כדי שיהיה זמין גם בקומפוננטות לקוח).

const DEFAULT_APP_URL = "https://allura.info";

/** האם הוגדר דומיין קנוני מפורש דרך משתנה הסביבה (פרודקשן). */
const ENV_APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim();

/** כתובת הבסיס המלאה של האפליקציה, ללא נטייה (trailing slash). */
export const APP_URL = (ENV_APP_URL || DEFAULT_APP_URL).replace(/\/+$/, "");

/** הדומיין בלבד (ללא פרוטוקול) — לתצוגת קישורים מקוצרים ומוקאפים. */
export const APP_DOMAIN = APP_URL.replace(/^https?:\/\//, "");

/** כתובת התמיכה הרשמית. */
export const SUPPORT_EMAIL = "support@allura.info";

/**
 * כתובת הבסיס לקישורים שמוצגים לבעלת העסק בדפדפן.
 * - אם הוגדר NEXT_PUBLIC_APP_URL — תמיד משתמשים בו (הדומיין הקנוני בפרודקשן).
 * - אחרת, בדפדפן משתמשים ב-origin הנוכחי כך שב-localhost / preview הקישור באמת ניתן ללחיצה
 *   ולא מצביע בטעות על דומיין הפרודקשן.
 * - בצד השרת ללא משתנה סביבה — נופלים חזרה לדומיין הקנוני.
 */
export function clientBaseUrl(): string {
  if (ENV_APP_URL) return APP_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return DEFAULT_APP_URL;
}

/** קישור מלא לעמוד הציבורי של עסק לפי slug — תמיד הדומיין הקנוני (להודעות/אימיילים שנוצרים בשרת). */
export function publicBusinessUrl(slug: string): string {
  return `${APP_URL}/b/${slug}`;
}

/**
 * קישור הזמנה ציבורי להצגה בדפדפן — מותאם ל-localhost/preview כשאין דומיין קנוני מוגדר,
 * וזהה ל-publicBusinessUrl בפרודקשן (כשמוגדר NEXT_PUBLIC_APP_URL).
 */
export function publicBusinessUrlClient(slug: string): string {
  return `${clientBaseUrl()}/b/${slug}`;
}
