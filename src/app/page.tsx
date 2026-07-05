import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { BRAND, META } from "@/lib/constants/he";
import { BRAND_DESCRIPTION } from "@/lib/config";
import { PublicBrandFooter } from "@/components/public/brand-footer";

// עמוד הבית הציבורי של Allura. עמוד זה הוא "תעודת הזהות" של המותג ברשת —
// הוא מציג בבירור את השם Allura בכותרת, בתוכן ובפוטר (נדרש גם לאימות
// שם התצוגה של WhatsApp מול Meta). משתמשות מחוברות מנותבות ללוח הבקרה.
export const metadata: Metadata = {
  title: META.title,
  description: META.description,
  alternates: { canonical: "/" },
};

const FEATURES = [
  {
    title: "ניהול תורים",
    body: "יומן תורים מסודר, אישורים, ביטולים ותזכורות — הכול במקום אחד.",
  },
  {
    title: "ניהול לקוחות",
    body: "כרטיס לקוחה עם היסטוריית תורים, הערות ומעקב אחרי לקוחות שלא חזרו.",
  },
  {
    title: "הודעות בוואטסאפ",
    body: "אישורי תור, תזכורות והודעות מוכנות לשליחה — בעברית פשוטה ומקצועית.",
  },
  {
    title: "תובנות לעסק",
    body: "הכנסות, חלונות פנויים והמלצות פעולה שעוזרות למלא את היומן.",
  },
] as const;

export default async function HomePage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="bg-background flex min-h-screen flex-col">
      {/* כותרת עליונה — המותג גלוי וברור */}
      <header className="border-b border-[var(--border)] bg-surface">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-base font-bold text-white"
              style={{
                background:
                  "linear-gradient(135deg, #c97898 0%, #b86b8c 52%, #9d6aa8 100%)",
              }}
            >
              A
            </span>
            <div>
              <span className="text-foreground block text-lg font-bold leading-none tracking-tight">
                {BRAND.name}
              </span>
              <span className="text-muted mt-0.5 block text-xs">
                {BRAND.tagline}
              </span>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-foreground rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--border)]/40"
            >
              התחברות
            </Link>
            <Link
              href="/signup"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{
                background:
                  "linear-gradient(135deg, #c97898 0%, #b86b8c 52%, #9d6aa8 100%)",
              }}
            >
              יצירת חשבון
            </Link>
          </nav>
        </div>
      </header>

      {/* אזור ראשי */}
      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-5 py-16 text-center sm:px-8 sm:py-20">
          <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
            Allura
          </h1>
          <p className="text-foreground-soft mx-auto mt-4 max-w-xl text-lg font-medium">
            {BRAND_DESCRIPTION}
          </p>
          <p className="text-muted mx-auto mt-3 max-w-xl leading-relaxed">
            Allura עוזרת לבעלות עסקים בתחום היופי והטיפוח לנהל תורים, לקוחות,
            שירותים והודעות ללקוחות — בפשטות, בעברית ובמקום אחד.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-xl px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{
                background:
                  "linear-gradient(135deg, #c97898 0%, #b86b8c 52%, #9d6aa8 100%)",
              }}
            >
              יצירת חשבון
            </Link>
            <Link
              href="/login"
              className="text-foreground rounded-xl border border-[var(--border)] bg-surface px-6 py-3 text-sm font-semibold transition-colors hover:bg-[var(--border)]/30"
            >
              כניסה למערכת
            </Link>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-5 pb-16 sm:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="bg-surface rounded-2xl border border-[var(--border)] p-5 text-right"
              >
                <h2 className="text-foreground text-base font-semibold">
                  {feature.title}
                </h2>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <PublicBrandFooter />
    </div>
  );
}
