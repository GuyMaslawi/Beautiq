// תצורה מרכזית לכתובות ולמותג.
// עד להשקה הסופית אנו משתמשים בדומיין קנוני אחד: https://allura.info
// בפרודקשן אפשר לדרוס את כתובת הבסיס דרך משתנה הסביבה NEXT_PUBLIC_APP_URL
// (חשוף לדפדפן — מתחיל ב-NEXT_PUBLIC_ כדי שיהיה זמין גם בקומפוננטות לקוח).

const DEFAULT_APP_URL = "https://allura.info";

/** האם הוגדר דומיין קנוני מפורש דרך משתנה הסביבה (פרודקשן). */
const ENV_APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim();

/**
 * מנרמל כתובת בסיס לכדי URL תקין: מסיר trailing slash, ומוסיף פרוטוקול https://
 * אם חסר — כדי ש-`new URL(APP_URL)` (ב-layout.tsx, metadataBase) לא יקרוס בבנייה
 * כשמישהו מגדיר NEXT_PUBLIC_APP_URL בלי http(s):// (למשל "allura.info").
 */
function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_APP_URL;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    new URL(withProtocol);
    return withProtocol;
  } catch {
    // ערך פגום לחלוטין — נופלים חזרה לדומיין הקנוני במקום להפיל את הבנייה.
    return DEFAULT_APP_URL;
  }
}

/** כתובת הבסיס המלאה של האפליקציה, ללא נטייה (trailing slash), עם פרוטוקול. */
export const APP_URL = normalizeBaseUrl(ENV_APP_URL || DEFAULT_APP_URL);

/** הדומיין בלבד (ללא פרוטוקול) — לתצוגת קישורים מקוצרים ומוקאפים. */
export const APP_DOMAIN = APP_URL.replace(/^https?:\/\//, "");

/** כתובת התמיכה הרשמית. */
export const SUPPORT_EMAIL = "support@allura.info";

/** תיאור המותג הרשמי — מוצג בעמודים ציבוריים (נדרש גם לאימות המותג מול Meta). */
export const BRAND_DESCRIPTION =
  "Allura היא מערכת CRM וניהול תורים לעסקי יופי וטיפוח בישראל.";

/**
 * שם הישות המשפטית שמפעילה את Allura (עוסק/חברה רשומים).
 * TODO: להגדיר NEXT_PUBLIC_LEGAL_ENTITY_NAME בפרודקשן — Meta מצפה לקשר ברור
 * בין המותג לעסק הרשום. כל עוד לא הוגדר, שורת "מופעלת על ידי" לא תוצג.
 */
export const LEGAL_ENTITY_NAME =
  process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim() || null;

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
