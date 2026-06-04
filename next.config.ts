import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // קיבוע שורש סביבת העבודה לתיקיית הפרויקט.
  // קיים package-lock.json נוסף בתיקיית הבית, ובלי קיבוע זה
  // Next עלול לבחור בטעות את תיקיית האב כשורש.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
