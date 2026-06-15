// תצורה מרכזית לכתובות ולמותג.
// עד להשקה הסופית אנו משתמשים בדומיין קנוני אחד: https://allura.info
// בפרודקשן אפשר לדרוס את כתובת הבסיס דרך משתנה הסביבה NEXT_PUBLIC_APP_URL
// (חשוף לדפדפן — מתחיל ב-NEXT_PUBLIC_ כדי שיהיה זמין גם בקומפוננטות לקוח).

const DEFAULT_APP_URL = "https://allura.info";

/** כתובת הבסיס המלאה של האפליקציה, ללא נטייה (trailing slash). */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_APP_URL).replace(
  /\/+$/,
  "",
);

/** הדומיין בלבד (ללא פרוטוקול) — לתצוגת קישורים מקוצרים ומוקאפים. */
export const APP_DOMAIN = APP_URL.replace(/^https?:\/\//, "");

/** כתובת התמיכה הרשמית. */
export const SUPPORT_EMAIL = "support@allura.info";

/** קישור מלא לעמוד הציבורי של עסק לפי slug. */
export function publicBusinessUrl(slug: string): string {
  return `${APP_URL}/b/${slug}`;
}
