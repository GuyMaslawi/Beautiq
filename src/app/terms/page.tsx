import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  BRAND_DESCRIPTION,
  LEGAL_ENTITY_NAME,
  SUPPORT_EMAIL,
} from "@/lib/config";
import { ALLURA_PLAN, PLAN_PRICE_VAT_NOTE } from "@/lib/plans";
import { PublicBrandFooter } from "@/components/public/brand-footer";

// עמוד ציבורי — תנאי שימוש. אינו דורש התחברות ואינו משתמש
// במעטפת המאומתת (סרגל צד). נדרש לפרסום אפליקציית Meta/WhatsApp.
export const metadata: Metadata = {
  title: "תנאי שימוש — Allura",
  description: "תנאי השימוש בשירות Allura לניהול עסקי יופי וטיפוח.",
};

const LAST_UPDATED = "29 ביולי 2026";

/**
 * מספר הימים שבהם הגישה נשמרת אחרי חיוב מתחדש שנכשל, לפני שהמנוי פוקע.
 * חייב להישאר תואם ל-RENEWAL_GRACE_DAYS בצד השרת
 * (src/server/subscription/service.ts) — לא מיובא ישירות כדי לא לגרור
 * מודול שרת לעמוד ציבורי.
 */
const RENEWAL_GRACE_DAYS_TEXT = "3";

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
    <div className="app-ambient flex min-h-dvh flex-col">
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
            לנהל תורים, לקוחות, שירותים, מחירים, שעות פעילות, ביטולים
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

        <Section title="המנוי והמחיר">
          <p>
            השימוש בשירות מחייב מנוי חודשי בתשלום. קיים מנוי אחד בלבד, הכולל את
            כל הכלים בשירות:
          </p>
          <ul className="list-disc space-y-2 pr-5">
            <li>
              <span className="font-medium">{ALLURA_PLAN.name}</span> —{" "}
              {ALLURA_PLAN.price} ₪ לחודש, {PLAN_PRICE_VAT_NOTE}.
            </li>
          </ul>
          <p>
            המחירים נקובים בשקלים חדשים וכוללים מע״מ. עבור כל חיוב תונפק לך
            חשבונית מס קבלה, ובה יופיע פירוט המס. אנו רשאים לעדכן את המחיר מעת לעת; עדכון
            מחיר למנוי קיים ייכנס לתוקף רק לאחר הודעה מראש, ולא יחול על תקופה
            ששולמה כבר. מחיר מיוחד שסוכם עמך באופן פרטני גובר על
            המחיר המוצג.
          </p>
        </Section>

        <Section title="חיוב חודשי מתחדש">
          <p>
            המנוי הוא <span className="font-medium">עסקה מתמשכת בחיוב חודשי
            מתחדש</span>. בעת ההצטרפות אתה נותן הרשאה לחיוב חוזר של אמצעי התשלום
            שמסרת, באמצעות ספק סליקה חיצוני. החיוב מתבצע מדי חודש, באותו יום
            בחודש שבו הצטרפת, וממשיך אוטומטית עד שתבטל את המנוי.
          </p>
          <p>
            פרטי אמצעי התשלום נמסרים ישירות לספק הסליקה ואינם נשמרים במערכות
            Allura.
          </p>
          <p>
            אם חיוב מתחדש נכשל (למשל כרטיס שפג תוקפו), הגישה לשירות נשמרת למשך{" "}
            {RENEWAL_GRACE_DAYS_TEXT} ימים נוספים כדי לאפשר לך לעדכן את אמצעי
            התשלום. בתום התקופה הזו, אם לא נקלט תשלום, המנוי פוקע והגישה לחשבון
            נחסמת. הנתונים שלך אינם נמחקים עם פקיעת המנוי.
          </p>
        </Section>

        <Section title="ביטול המנוי">
          <p>
            אפשר לבטל את המנוי בכל עת, ללא קנס וללא דמי ביטול, ישירות מתוך
            המערכת: <span className="font-medium">הגדרות → המנוי שלי → ביטול
            מנוי</span>. אפשר גם לשלוח הודעת ביטול לכתובת התמיכה שבתחתית עמוד זה.
          </p>
          <p>
            עם הביטול מופסק החיוב החודשי המתחדש ולא יבוצעו חיובים נוספים. הגישה
            לשירות נשמרת עד תום התקופה החודשית ששולמה, ומסתיימת בסופה.
          </p>
        </Section>

        <Section title="החזרים">
          <p>
            החיוב הוא חודשי מראש. ביטול במהלך חודש פעיל אינו מזכה בהחזר יחסי עבור
            אותו חודש, אלא אם נקבע אחרת בדין או סוכם אחרת מולנו בכתב. חויבת
            בטעות, או שהשירות לא היה זמין לאורך זמן משמעותי? פנה אלינו ונטפל בכך
            בהגינות.
          </p>
        </Section>

        <Section title="הנתונים שלך — ייצוא ומחיקה">
          <p>
            הנתונים שהזנת למערכת (לקוחות, תורים, שירותים) שייכים לך. אפשר לייצא
            אותם לקובץ בכל עת מתוך <span className="font-medium">הגדרות → הנתונים
            שלך</span>, גם אחרי ביטול המנוי, כל עוד החשבון קיים.
          </p>
          <p>
            אפשר לבקש את מחיקת החשבון וכל הנתונים שבו בפנייה לכתובת התמיכה. נבצע
            את המחיקה בתוך 30 יום ממועד אימות הבקשה. המחיקה היא סופית ואינה
            ניתנת לשחזור, ולכן מומלץ לייצא את הנתונים לפניה. פרטים נוספים
            במדיניות הפרטיות.
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

        <Section title="השעיה וסיום השימוש">
          <p>
            אנו רשאים להשעות או לסיים חשבון במקרה של אי-תשלום, הפרה של תנאי
            השימוש, או שימוש שפוגע במערכת, בלקוחות או בעסקים אחרים. במקרה של
            השעיה שאינה בשל אי-תשלום נודיע לך על כך ונאפשר לך לייצא את הנתונים,
            למעט במקרים דחופים של פגיעה באבטחה או בדין.
          </p>
        </Section>

        <Section title="דין וסמכות שיפוט">
          <p>
            על תנאים אלה ועל השימוש בשירות יחולו דיני מדינת ישראל בלבד. סמכות
            השיפוט הבלעדית בכל מחלוקת נתונה לבתי המשפט המוסמכים במחוז תל אביב.
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
