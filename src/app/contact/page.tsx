import type { Metadata } from "next";
import Link from "next/link";
import {
  APP_DOMAIN,
  APP_URL,
  BRAND_DESCRIPTION,
  SUPPORT_EMAIL,
} from "@/lib/config";
import { PublicBrandFooter } from "@/components/public/brand-footer";

// עמוד ציבורי — צור קשר. אינו דורש התחברות. מציג את פרטי הקשר הרשמיים
// של Allura (נדרש גם לאימות המותג מול Meta/WhatsApp).
export const metadata: Metadata = {
  title: "צור קשר — Allura",
  description: `יצירת קשר עם צוות Allura — ${SUPPORT_EMAIL}`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <main className="flex-1 px-5 py-12">
        <article className="bg-surface shadow-md mx-auto max-w-2xl rounded-2xl border border-[var(--border)] px-6 py-10 sm:px-10">
          <header className="border-b border-[var(--border)] pb-6">
            <Link
              href="/"
              className="text-primary text-sm font-medium hover:underline"
            >
              Allura
            </Link>
            <h1 className="text-foreground mt-3 text-3xl font-bold">צור קשר</h1>
            <p className="text-muted mt-2 text-sm">{BRAND_DESCRIPTION}</p>
          </header>

          <div className="text-foreground/90 mt-8 space-y-4 leading-relaxed">
            <p>
              יש לך שאלה, בקשה או צורך בעזרה? נשמח לשמוע ממך. הדרך הטובה ביותר
              ליצור איתנו קשר היא באימייל:
            </p>
            <p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-primary text-lg font-semibold hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
            <p>
              אנחנו משתדלים לענות לכל פנייה בתוך יום עסקים אחד.
            </p>
            <p className="text-muted text-sm">
              האתר הרשמי של Allura:{" "}
              <a
                href={APP_URL}
                className="text-primary font-medium hover:underline"
              >
                {APP_DOMAIN}
              </a>
            </p>
          </div>

          <footer className="mt-10 border-t border-[var(--border)] pt-6">
            <p className="text-muted text-sm">
              מידע נוסף:{" "}
              <Link
                href="/privacy"
                className="text-primary font-medium hover:underline"
              >
                מדיניות פרטיות
              </Link>{" "}
              ·{" "}
              <Link
                href="/terms"
                className="text-primary font-medium hover:underline"
              >
                תנאי שימוש
              </Link>
            </p>
          </footer>
        </article>
      </main>

      <PublicBrandFooter />
    </div>
  );
}
