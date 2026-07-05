import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  BRAND_DESCRIPTION,
  LEGAL_ENTITY_NAME,
  SUPPORT_EMAIL,
} from "@/lib/config";

// עמוד ציבורי — מדיניות פרטיות. אינו דורש התחברות ואינו משתמש
// במעטפת המאומתת (סרגל צד). נדרש לפרסום אפליקציית Meta/WhatsApp.
export const metadata: Metadata = {
  title: "מדיניות פרטיות — Allura",
  description:
    "מדיניות הפרטיות של Allura — איזה מידע אנו אוספים, כיצד אנו משתמשים בו וכיצד אנו שומרים עליו.",
};

const LAST_UPDATED = "14 ביוני 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-foreground-soft text-xl font-semibold">{title}</h2>
      <div className="text-foreground/90 mt-3 space-y-3 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="bg-background min-h-screen px-5 py-12">
      <article className="bg-surface shadow-md mx-auto max-w-2xl rounded-2xl border border-[var(--border)] px-6 py-10 sm:px-10">
        <header className="border-b border-[var(--border)] pb-6">
          <Link
            href="/"
            className="text-primary text-sm font-medium hover:underline"
          >
            Allura
          </Link>
          <h1 className="text-foreground mt-3 text-3xl font-bold">
            מדיניות פרטיות
          </h1>
          <p className="text-muted mt-2 text-sm">עודכן לאחרונה: {LAST_UPDATED}</p>
        </header>

        <Section title="מה זה Allura">
          <p>
            Allura היא מערכת לניהול עסקי יופי וטיפוח (SaaS) המיועדת לבעלי עסקים
            בישראל. המערכת מאפשרת לבעל העסק לנהל תורים, לקוחות, שירותים, מחירים,
            שעות פעילות, מקדמות, ביטולים והודעות מוכנות לשליחה בוואטסאפ.
          </p>
          <p>
            Allura היא כלי עבור בעלי עסקים. בעל העסק הוא האחראי על המידע של הלקוחות
            שהוא מזין למערכת ועל ההודעות שהוא שולח באמצעותה. אנו מספקים את הכלי,
            ובעל העסק אחראי על השימוש בו ועל קבלת ההסכמות הנדרשות מהלקוחות שלו.
          </p>
        </Section>

        <Section title="איזה מידע אנו אוספים">
          <p>אנו אוספים את סוגי המידע הבאים:</p>
          <ul className="list-disc space-y-2 pr-5">
            <li>
              <strong>פרטי חשבון בעל העסק:</strong> שם, כתובת אימייל, מספר טלפון,
              שם העסק ופרטי העסק.
            </li>
            <li>
              <strong>נתוני לקוחות שמוזנים על ידי בעל העסק:</strong> שמות לקוחות,
              מספרי טלפון, היסטוריית תורים, הערות ופרטים נוספים שבעל העסק בוחר
              להזין.
            </li>
            <li>
              <strong>נתוני תורים:</strong> תאריכים, שעות, שירותים, מחירים, מקדמות,
              סטטוס תור וביטולים.
            </li>
            <li>
              <strong>נתוני הודעות וואטסאפ:</strong> תוכן ההודעות המוכנות לשליחה,
              נמענים, סטטוס שליחה ובקשות הסרה (Opt-Out).
            </li>
            <li>
              <strong>נתוני עמוד הזמנות ציבורי:</strong> פרטים שלקוחות מזינים בעמוד
              ההזמנות הציבורי של העסק, כגון שם, טלפון ושירות מבוקש.
            </li>
            <li>
              <strong>נתוני שימוש ויומן (Log):</strong> כתובת IP, סוג דפדפן, זמני
              גישה ופעולות במערכת, לצורכי אבטחה ושיפור השירות.
            </li>
          </ul>
        </Section>

        <Section title="מדוע אנו משתמשים במידע">
          <ul className="list-disc space-y-2 pr-5">
            <li>כדי לספק ולהפעיל את שירותי המערכת.</li>
            <li>כדי לאפשר ניהול תורים, לקוחות ושליחת הודעות.</li>
            <li>כדי לשמור על אבטחת המערכת ולמנוע שימוש לרעה.</li>
            <li>כדי לשפר את השירות ולתת תמיכה למשתמשים.</li>
            <li>כדי לעמוד בדרישות חוקיות ורגולטוריות.</li>
          </ul>
        </Section>

        <Section title="אינטגרציה עם WhatsApp ו-Meta">
          <p>
            Allura משתלבת עם שירותי WhatsApp באמצעות הפלטפורמה של Meta כדי לאפשר
            לבעלי עסקים לשלוח הודעות ללקוחותיהם. בעת השימוש באינטגרציה, מידע
            הנדרש לשליחת ההודעות (כגון מספר הטלפון של הנמען ותוכן ההודעה) מועבר
            לשירותי Meta בכפוף לתנאי השימוש ולמדיניות הפרטיות של Meta.
          </p>
          <p>
            בעל העסק אחראי לוודא שיש בידיו את ההסכמה המתאימה מהלקוחות לקבלת הודעות
            וואטסאפ, בהתאם למדיניות של WhatsApp ולחוק החל.
          </p>
        </Section>

        <Section title="ספקי שירות">
          <p>
            אנו נעזרים בספקי שירות חיצוניים כדי להפעיל את המערכת, ובהם ספקי
            אחסון (Hosting), בסיסי נתונים, שירותי אימייל וספקי שליחת הודעות וואטסאפ
            (Meta). ספקים אלה מקבלים גישה למידע רק במידה הנדרשת לאספקת השירות,
            והם מחויבים לשמור על סודיות ואבטחת המידע.
          </p>
        </Section>

        <Section title="אבטחת מידע">
          <p>
            אנו נוקטים באמצעים סבירים לאבטחת המידע, לרבות הצפנה, בקרת גישה והפרדה
            בין נתוני עסקים שונים (Multi-Tenant). עם זאת, אף שיטת אבטחה אינה מושלמת,
            ואיננו יכולים להבטיח אבטחה מוחלטת.
          </p>
        </Section>

        <Section title="שמירת מידע">
          <p>
            אנו שומרים את המידע כל עוד חשבון העסק פעיל, או כל עוד הדבר נדרש כדי
            לספק את השירות, לעמוד בדרישות חוקיות או לפתור מחלוקות. בעל העסק יכול
            לבקש מחיקה של נתונים בכפוף למגבלות החוק.
          </p>
        </Section>

        <Section title="זכויותיך ויצירת קשר">
          <p>
            בכפוף לחוק החל, ייתכן שתהיה לך זכות לעיין במידע שלך, לתקן אותו או לבקש
            את מחיקתו. בכל שאלה או בקשה בנוגע לפרטיות תוכל לפנות אלינו בכתובת:
          </p>
          <p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-primary font-medium hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </Section>

        <footer className="mt-10 border-t border-[var(--border)] pt-6">
          <p className="text-muted text-sm">{BRAND_DESCRIPTION}</p>
          {LEGAL_ENTITY_NAME && (
            <p className="text-muted mt-2 text-sm">
              Allura מופעלת על ידי {LEGAL_ENTITY_NAME}.
            </p>
          )}
          <p className="text-muted mt-2 text-sm">
            ראה גם:{" "}
            <Link
              href="/terms"
              className="text-primary font-medium hover:underline"
            >
              תנאי שימוש
            </Link>{" "}
            ·{" "}
            <Link
              href="/contact"
              className="text-primary font-medium hover:underline"
            >
              צור קשר
            </Link>
          </p>
        </footer>
      </article>
    </main>
  );
}
