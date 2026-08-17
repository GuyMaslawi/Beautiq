import { NextResponse, type NextRequest } from "next/server";

/**
 * שכבת הגנה קצה (edge) לכל בקשה — שני תפקידים:
 *
 * 1. **חסימה כברירת מחדל (deny by default).**
 *    עד עכשיו כל הגנה באפליקציה הייתה פר-עמוד: כל route קרא בעצמו
 *    `requirePaidUser()` / `requireCurrentBusiness()`. זה עובד — אבל זו הגנה
 *    שתלויה בזיכרון של המפתח. עמוד חדש שנוסיף בלי לקרוא ל-guard נולד חשוף,
 *    ואין שום דבר שיתריע. כאן ההיגיון הפוך: *הכול* סגור, ורק נתיבים שמופיעים
 *    במפורש ברשימת ההיתר למטה נגישים ללא התחברות.
 *
 *    זו שכבת עומק (defense in depth) ולא מקור האמת. ה-middleware בודק רק
 *    *נוכחות* של עוגיית סשן — הוא לא מאמת חתימה, לא ניגש למסד הנתונים, ולא
 *    יודע מי המשתמשת. האימות האמיתי (מי את, שילמת, מושהית, לאיזה עסק את
 *    שייכת) נשאר בשרת: src/server/auth/session.ts. המטרה כאן היא שנתיב שנשכח
 *    ייכשל סגור במקום להיפתח לרווחה.
 *
 * 2. **CSP עם nonce לכל בקשה.**
 *    ה-CSP הקודם נאלץ לכלול `'unsafe-inline'` ב-script-src כי Next מזריק
 *    סקריפטים inline עם מטען ה-RSC, ובלי middleware לא היה מי שייצר nonce.
 *    `'unsafe-inline'` מנטרל כמעט לגמרי את ההגנה של CSP מפני XSS — כל סקריפט
 *    שיוזרק לדף היה מורשה לרוץ. עכשיו כל בקשה מקבלת nonce אקראי, Next חותם
 *    בו את הסקריפטים שלו, ו-`'strict-dynamic'` מרחיב את האמון רק לסקריפטים
 *    שסקריפט מהימן טען בעצמו (כך ה-SDK של Meta ממשיך לעבוד).
 */

/** נתיבים ציבוריים מדויקים — שיווק, הרשמה והתחברות. */
const PUBLIC_EXACT = new Set([
  "/", // מפנה בעצמו: מחוברת → /dashboard, אחרת → /login
  "/login",
  "/signup",
  // שחזור סיסמה — מעצם טבעו נגיש למי שאינה יכולה להתחבר. מוגן בטוקן חד-פעמי
  // קצר-מועד ובהגבלת קצב, לא בסשן (ראו server/auth/password-reset.ts).
  "/forgot-password",
  "/reset-password",
  "/about",
  "/intro", // סרטון הסברה אינטראקטיבי ללקוחות פוטנציאליות
  "/contact",
  "/privacy",
  "/terms",
]);

/**
 * קידומות ציבוריות. כל אחת מוגנת באמצעי משלה — לא באמצעות סשן:
 *   /b/                        — עמוד ההזמנות הציבורי (חשוף בכוונה, מוגבל בקצב)
 *   /api/auth/                 — NextAuth עצמו
 *   /api/public/               — חיפוש חלונות פנויים ציבורי (מוגבל בקצב)
 *   /api/cron/                 — CRON_SECRET
 *   /api/health                — בדיקת חיים
 *   /api/subscription/webhook  — סוד משותף מול Grow
 *   /api/whatsapp/webhook      — חתימת HMAC של Meta
 */
const PUBLIC_PREFIXES = [
  "/b/",
  "/api/auth/",
  "/api/public/",
  "/api/cron/",
  "/api/health",
  "/api/subscription/webhook",
  "/api/whatsapp/webhook",
];

/**
 * שמות עוגיית הסשן של Auth.js — עם ובלי הקידומת המאובטחת (HTTPS), וגם
 * הגרסה המפוצלת לחלקים (`.0`, `.1`) שנוצרת כשהטוקן ארוך.
 */
const SESSION_COOKIE_RE = /^(__Secure-)?authjs\.session-token(\.\d+)?$/;

/**
 * התאמת קידומת עם *גבול נתיב*, ולא startsWith גולמי.
 *
 * `"/api/health".startsWith` פותח גם את `/api/health-internal` ו-`/api/healthz`,
 * ו-`"/b/"` פותח כל דבר שמתחיל כך. רשימת ההיתר הזו היא היחידה שמפרידה בין
 * "פתוח לכולם" ל"דורש סשן", ולכן היא חייבת להתאים בדיוק לנתיב עצמו או
 * לתת-נתיב שלו — לא לכל מחרוזת שבמקרה מתחילה באותן אותיות. נתיב חדש שנוסיף
 * מחר ליד אחד מאלה ייוולד סגור, כפי שהכוונה כאן.
 */
function matchesPrefix(pathname: string, prefix: string): boolean {
  const base = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return pathname === base || pathname.startsWith(`${base}/`);
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => SESSION_COOKIE_RE.test(c.name));
}

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic': דפדפנים תומכים מתעלמים מרשימת המארחים ומאמינים רק
    // לסקריפטים שסקריפט חתום-nonce טען. connect.facebook.net נשאר כרשת ביטחון
    // לדפדפנים ישנים שאינם תומכים ב-strict-dynamic.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://connect.facebook.net`,
    // ב-style-src עדיין נדרש unsafe-inline (Tailwind ו-style props של React).
    // זה וקטור חלש בהרבה מסקריפט inline.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://graph.facebook.com https://www.facebook.com",
    "frame-src 'self' https://www.facebook.com",
    // 'self' ולא 'none': התצוגה המקדימה של עמוד הלקוחות (/public-page) מטמיעה
    // את /b/[slug] ב-iframe מאותו מקור. 'none' חוסם גם הטמעה עצמית ולכן שבר
    // אותה. same-origin עדיין מונע clickjacking מאתר זר.
    "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // מעבדת העיצוב היא אב-טיפוס ויזואלי בלבד. אין סיבה שתהיה נגישה בייצור.
  if (pathname.startsWith("/design-lab") && process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  if (!isPublicPath(pathname) && !hasSessionCookie(request)) {
    // ל-API מחזירים 401 ולא הפניה — לקוח fetch מצפה ל-JSON, ודף HTML של
    // התחברות היה נראה לו כתשובה תקינה.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    // בלי callbackUrl מה-URL הנכנס — פרמטר חזרה שמגיע מהלקוח הוא הדרך
    // הקלאסית ליצור open redirect.
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  // Next קורא את ה-nonce מכותרת ה-CSP של *הבקשה* ומחיל אותו על הסקריפטים
  // שהוא מייצר. x-nonce נחשף כדי שקומפוננטה תוכל לקרוא אותו במידת הצורך.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * כל נתיב פרט לנכסים סטטיים ולקבצי מטא. הנכסים אינם HTML ולכן אינם
     * זקוקים ל-CSP, והחרגתם חוסכת הרצת middleware על כל תמונה.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
