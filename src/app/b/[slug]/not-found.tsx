import { Flower2 } from "lucide-react";

/**
 * 404 לעמוד ההזמנות הציבורי.
 *
 * מוצג כאשר ה-slug אינו קיים — וגם כאשר בעלת העסק מושהית או שהמנוי שלה פקע
 * (getPublicBusiness מחזיר null בכל אחד מהמקרים, ו-page.tsx קורא notFound()).
 *
 * חשוב שזה יחזיר 404 אמיתי ולא 200: העמוד הקודם רינדר את הכרטיס הזה בתוך
 * תגובת 200 רגילה, כך שקישור מת — או עסק מושהה בכוונה — נראה לכל בודק
 * קישורים, uptime monitor או מנוע חיפוש כעמוד תקין וקיים. התוכן זהה; רק
 * קוד הסטטוס תוקן. אף פרט של העסק המושהה אינו נחשף כאן — זהו טקסט גנרי.
 */
export default function PublicBusinessNotFound() {
  return (
    <main
      className="app-ambient flex min-h-dvh items-center justify-center p-6"
      dir="rtl"
    >
      <div className="aura-card w-full max-w-sm rounded-[1.75rem] px-8 py-10 text-center">
        <span className="brand-chip mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
          <Flower2 className="h-5 w-5" />
        </span>
        <h1 className="font-display mt-5 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          הקישור לא נמצא
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          כדאי לבדוק את הקישור שקיבלת מהעסק ולנסות שוב.
        </p>
      </div>
    </main>
  );
}
