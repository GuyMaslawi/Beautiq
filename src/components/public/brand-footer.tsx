import Link from "next/link";
import {
  APP_DOMAIN,
  APP_URL,
  BRAND_DESCRIPTION,
  LEGAL_ENTITY_NAME,
  SUPPORT_EMAIL,
} from "@/lib/config";

/**
 * פוטר מותג לעמודים הציבוריים (עמוד הבית, צור קשר).
 * מציג בבירור את שם המותג, הדומיין הרשמי וכתובת התמיכה — נדרש גם
 * לאימות שם התצוגה של WhatsApp מול Meta (הוכחת קשר מותג↔דומיין).
 */
export function PublicBrandFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-5 py-10 text-center sm:px-8">
        <p className="text-foreground text-lg font-bold tracking-tight">
          Allura
        </p>
        <p className="text-muted max-w-md text-sm leading-relaxed">
          {BRAND_DESCRIPTION}
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-primary font-medium hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
          <a
            href={APP_URL}
            className="text-primary font-medium hover:underline"
          >
            {APP_DOMAIN}
          </a>
        </div>

        <nav className="mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          <Link href="/contact" className="text-muted hover:text-foreground hover:underline">
            צור קשר
          </Link>
          <Link href="/privacy" className="text-muted hover:text-foreground hover:underline">
            מדיניות פרטיות
          </Link>
          <Link href="/terms" className="text-muted hover:text-foreground hover:underline">
            תנאי שימוש
          </Link>
        </nav>

        {LEGAL_ENTITY_NAME && (
          <p className="text-muted mt-2 text-xs">
            Allura מופעלת על ידי {LEGAL_ENTITY_NAME}.
          </p>
        )}

        <p className="text-muted mt-2 text-xs">
          © {new Date().getFullYear()} Allura — כל הזכויות שמורות
        </p>
      </div>
    </footer>
  );
}
