import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  BRAND_DESCRIPTION,
  LEGAL_ENTITY_NAME,
  SUPPORT_EMAIL,
} from "@/lib/config";
import { PublicBrandFooter } from "@/components/public/brand-footer";

// עמוד ציבורי — תנאי שימוש. אינו דורש התחברות ואינו משתמש
// במעטפת המאומתת (סרגל צד). נדרש לפרסום אפליקציית Meta/WhatsApp.
export const metadata: Metadata = {
  title: "תנאי שימוש — Allura",
  description: "תנאי השימוש בשירות Allura לניהול עסקי יופי וטיפוח.",
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
      <h2 className="font-display text-foreground-soft text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="text-foreground/90 mt-3 space-y-3 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="app-ambient flex min-h-screen flex-col">
      <main className="flex-1 px-5 py-12">
      <article className="aura-card mx-auto max-w-3xl rounded-3xl px-6 py-10 sm:px-10">
        <header>
          <Link
            href="/"
            className="eyebrow text-primary hover:underline"
          >
            Allura
          </Link>
          <h1 className="font-display text-foreground mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            תנאי שימוש
          </h1>
          <p className="text-muted mt-2 text-sm">עודכן לאחרונה: {LAST_UPDATED}</p>
          <div className="editorial-rule mt-6" />
        </header>

        <Section title="תיאור השירות">
          <p>
            Allura היא מערכת לניהול עסקי יופי וטיפוח (SaaS) המאפשרת לבעלי עסקים
            לנהל תורים, לקוחות, שירותים, מחירים, שעות פעילות, מקדמות, ביטולים
            והודעות מוכנות לשליחה בוואטסאפ. השימוש בשירות כפוף לתנאים אלה.
          </p>
        </Section>

        <Section title="אחריות על החשבון">
          <p>
            אתה אחראי לשמור על סודיות פרטי ההתחברות שלך ועל כל פעולה שמתבצעת
            בחשבונך. עליך לספק מידע נכון ומעודכן בעת ההרשמה והשימוש בשירות.
          </p>
        </Section>

        <Section title="אחריות בעל העסק על נתוני לקוחות והסכמת וואטסאפ">
          <p>
            בעל העסק הוא האחראי הבלעדי על נתוני הלקוחות שהוא מזין למערכת ועל
            ההודעות שהוא שולח באמצעותה. עליך לוודא שיש בידיך את ההסכמה הנדרשת
            מהלקוחות לשליחת הודעות וואטסאפ, בהתאם למדיניות של WhatsApp ו-Meta ולחוק
            החל בישראל.
          </p>
        </Section>

        <Section title="שימוש מותר">
          <p>אסור להשתמש בשירות באופן הבא:</p>
          <ul className="list-disc space-y-2 pr-5">
            <li>למשלוח דואר זבל (Spam) או הודעות לא רצויות.</li>
            <li>להפרת חוקים או זכויות של צד שלישי.</li>
            <li>לניסיון לפגוע באבטחת המערכת או בתקינותה.</li>
            <li>לשימוש לרעה בנתונים של לקוחות או של עסקים אחרים.</li>
          </ul>
        </Section>

        <Section title="אין התחייבות למסירת הודעות וואטסאפ">
          <p>
            שליחת הודעות וואטסאפ מתבצעת באמצעות שירותי צד שלישי (Meta) ואינה
            בשליטתנו המלאה. איננו מתחייבים שכל הודעה תימסר, ואיננו אחראים לעיכובים,
            כשלים או חסימות מצד WhatsApp או Meta.
          </p>
        </Section>

        <Section title="מנויים ותשלום">
          <p>
            השירות עשוי לכלול תוכניות בתשלום, מנויים או תקופת ניסיון. המחירים
            ותנאי התשלום יוצגו במערכת או במסמך נפרד.
          </p>
        </Section>

        <Section title="הגבלת אחריות">
          <p>
            השירות מסופק כפי שהוא (As Is). במידה המרבית המותרת בחוק, איננו אחראים
            לכל נזק ישיר או עקיף הנובע מהשימוש בשירות, לרבות אובדן נתונים, אובדן
            הכנסות או הפרעות בשירות.
          </p>
        </Section>

        <Section title="שינויים בשירות">
          <p>
            אנו רשאים לעדכן, לשנות או להפסיק חלקים מהשירות מעת לעת, וכן לעדכן תנאים
            אלה. המשך השימוש בשירות לאחר עדכון מהווה הסכמה לתנאים המעודכנים.
          </p>
        </Section>

        <Section title="יצירת קשר">
          <p>בכל שאלה בנוגע לתנאי השימוש תוכל לפנות אלינו בכתובת:</p>
          <p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-primary font-medium hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </Section>

        <footer className="mt-10">
          <div className="editorial-rule mb-6" />
          <p className="text-muted text-sm">{BRAND_DESCRIPTION}</p>
          {LEGAL_ENTITY_NAME && (
            <p className="text-muted mt-2 text-sm">
              Allura מופעלת על ידי {LEGAL_ENTITY_NAME}.
            </p>
          )}
          <p className="text-muted mt-2 text-sm">
            ראה גם:{" "}
            <Link
              href="/privacy"
              className="text-primary font-medium hover:underline"
            >
              מדיניות פרטיות
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

      <PublicBrandFooter />
    </div>
  );
}
