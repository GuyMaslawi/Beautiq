import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/config";

/**
 * sitemap.xml — נבנה על ידי Next בכתובת /sitemap.xml.
 *
 * מכיל את עמודי המותג הציבוריים בלבד. עמודי ההזמנות של העסקים (/b/[slug])
 * *אינם* נכללים בכוונה: הוספתם הייתה מפרסמת ברשת רשימה מלאה ושמית של כל
 * הלקוחות של Allura. הם ממילא מותרים לזחילה ב-robots.txt ומתגלים דרך הקישור
 * שבעלת העסק משתפת בעצמה (וואטסאפ / אינסטגרם) — וזו בדיוק דרך ההפצה שהמוצר
 * בנוי סביבה (CLAUDE.md: העמודים הציבוריים הם כלי עזר, לא פלטפורמת גילוי).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${APP_URL}/about`,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${APP_URL}/contact`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${APP_URL}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${APP_URL}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
