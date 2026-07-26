import type { NextConfig } from "next";

// כותרות אבטחה בסיסיות לכל מסלול. נשמרות שמרניות כדי לא לשבור
// טעינת SDK של Meta (Embedded Signup) או תצוגת תמונות מ-Vercel Blob.
/**
 * Content-Security-Policy.
 *
 * מקורות שהאפליקציה באמת צריכה:
 *   - connect.facebook.net / www.facebook.com / graph.facebook.com —
 *     ה-SDK של Meta לחיבור WhatsApp (Embedded Signup).
 *   - blob.vercel-storage.com — תמונות שהועלו (לוגו, תמונת רקע, גלריה).
 *   - הגופנים נטענים דרך next/font ומאוחסנים אצלנו, ולכן אין צורך
 *     ב-fonts.googleapis.com.
 *
 * 'unsafe-inline' ב-script-src נחוץ כל עוד אין middleware שמייצר nonce לכל
 * בקשה — Next.js מזריק סקריפטים inline עם נתוני ה-RSC. שאר ההנחיות עדיין
 * חוסמות את הווקטורים המשמעותיים: טעינת סקריפט חיצוני, מסגור (framing),
 * חטיפת &lt;base&gt;, ושליחת טפסים ליעד חיצוני. השדרוג ל-nonce + 'strict-dynamic'
 * דורש הוספת src/middleware.ts.
 *
 * img-src מתיר https: כללי כי בעלות עסק מזינות כתובות תמונה חיצוניות
 * לגלריה ולמיתוג. הכתובות עצמן מאומתות בצד השרת (https בלבד, עם תקרת אורך)
 * ב-src/lib/validation/url.ts, כך ש-javascript:/data: נחסמים במקור.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://graph.facebook.com https://www.facebook.com",
  "frame-src 'self' https://www.facebook.com",
  // חוסם הטמעה של האפליקציה באתר אחר (הגרסה המודרנית של X-Frame-Options).
  "frame-ancestors 'none'",
  // טפסים יכולים להישלח רק אלינו — מונע גניבת פרטים דרך HTML שהוזרק.
  "form-action 'self'",
  // מונע הזרקת <base href> שמסיטה טעינת סקריפטים לדומיין זר.
  "base-uri 'none'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  // מונע ניחוש סוג תוכן (MIME sniffing).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // מצמצם דליפת referrer לאתרים חיצוניים.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // אוסר הטמעת האפליקציה ב-iframe (הגנה מפני clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // כופה HTTPS לשנה קדימה (כולל תת-דומיינים).
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // צמצום הרשאות דפדפן שאיננו צריכים.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // בידוד ההקשר מדפים אחרים. allow-popups נדרש כדי שחלון ה-FB.login
  // של חיבור WhatsApp ימשיך לעבוד (same-origin לבדו שובר את window.opener).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  // קיבוע שורש סביבת העבודה לתיקיית הפרויקט.
  // קיים package-lock.json נוסף בתיקיית הבית, ובלי קיבוע זה
  // Next עלול לבחור בטעות את תיקיית האב כשורש.
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
