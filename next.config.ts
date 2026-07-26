import type { NextConfig } from "next";

/**
 * כותרות אבטחה סטטיות לכל מסלול.
 *
 * ה-Content-Security-Policy *אינו* כאן — הוא נבנה פר-בקשה ב-src/middleware.ts,
 * כי הוא מכיל nonce אקראי לכל טעינה. הגדרת CSP בשני המקומות הייתה מייצרת שתי
 * כותרות שנאכפות במקביל (חיתוך שלהן), מה שהיה שובר את הדף.
 *
 * img-src (ב-middleware) מתיר https: כללי כי בעלות עסק מזינות כתובות תמונה
 * חיצוניות לגלריה ולמיתוג. הכתובות עצמן מאומתות בצד השרת (https בלבד, עם
 * תקרת אורך) ב-src/lib/validation/url.ts, כך ש-javascript:/data: נחסמים במקור.
 */
const securityHeaders = [
  // מונע ניחוש סוג תוכן (MIME sniffing).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // מצמצם דליפת referrer לאתרים חיצוניים.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // אוסר הטמעה מאתר זר (הגנה מפני clickjacking בדפדפנים ישנים; המקבילה
  // המודרנית היא frame-ancestors ב-CSP שב-middleware).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // כופה HTTPS לשנה קדימה (כולל תת-דומיינים).
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // צמצום הרשאות דפדפן שאיננו צריכים.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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
