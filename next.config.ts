import type { NextConfig } from "next";

// כותרות אבטחה בסיסיות לכל מסלול. נשמרות שמרניות כדי לא לשבור
// טעינת SDK של Meta (Embedded Signup) או תצוגת תמונות מ-Vercel Blob.
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
