import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/config";

/**
 * robots.txt — נבנה על ידי Next בכתובת /robots.txt.
 *
 * ההיגיון זהה לזה של src/middleware.ts: **חסימה כברירת מחדל**. כמעט כל הכתובות
 * באפליקציה הן מאחור התחברות, ולכן זחילה שלהן לא מייצרת שום ערך — היא רק גורמת
 * לגוגל לאנדקס את דף ההתחברות שוב ושוב תחת עשרות כתובות שונות. במקום לתחזק
 * רשימת חסימות שתישכח בכל עמוד חדש, אנו חוסמים הכול ופותחים במפורש רק את מה
 * שאמור להתגלה בחיפוש.
 *
 * מה כן נפתח:
 *   /about, /contact, /privacy, /terms — עמודי המותג והמידע המשפטי.
 *   /b/                                — עמודי ההזמנות הציבוריים של העסקים.
 *                                        (נסגרים אוטומטית ומחזירים 404 כשהחשבון
 *                                        אינו משלם או מושהה — ראו
 *                                        src/server/public-booking/queries.ts)
 *
 * מה מכוון נשאר חסום: `/` (רק מפנה), /login ו-/signup (טפסים, לא תוכן),
 * /admin, /api ו-/design-lab.
 *
 * הערה: robots.txt מוכרע לפי ההתאמה הארוכה ביותר, ולכן כל שורת Allow כאן
 * גוברת על ה-Disallow הגורף.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/",
        allow: ["/about", "/contact", "/privacy", "/terms", "/b/"],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
