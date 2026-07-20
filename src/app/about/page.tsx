import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  MessageCircle,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { BRAND, META } from "@/lib/constants/he";
import { BRAND_DESCRIPTION } from "@/lib/config";
import { PublicBrandFooter } from "@/components/public/brand-footer";

// עמוד המותג הציבורי של Allura. עמוד זה הוא "תעודת הזהות" של המותג ברשת —
// הוא מציג בבירור את השם Allura בכותרת, בתוכן ובפוטר (נדרש גם לאימות
// שם התצוגה של WhatsApp מול Meta). שורש האתר (/) מפנה ישירות להתחברות.
export const metadata: Metadata = {
  title: META.title,
  description: META.description,
  alternates: { canonical: "/about" },
};

const FEATURES = [
  {
    icon: CalendarDays,
    title: "ניהול תורים",
    body: "יומן תורים מסודר, אישורים, ביטולים ותזכורות — הכול במקום אחד.",
  },
  {
    icon: Users,
    title: "ניהול לקוחות",
    body: "כרטיס לקוחה עם היסטוריית תורים, הערות ומעקב אחרי לקוחות שלא חזרו.",
  },
  {
    icon: MessageCircle,
    title: "הודעות בוואטסאפ",
    body: "אישורי תור, תזכורות והודעות מוכנות לשליחה — בעברית פשוטה ומקצועית.",
  },
  {
    icon: TrendingUp,
    title: "תובנות לעסק",
    body: "הכנסות, חלונות פנויים והמלצות פעולה שעוזרות למלא את היומן.",
  },
] as const;

const TRUST_POINTS = [
  "עברית מלאה וממשק בכיוון ימין לשמאל",
  "מותאם לעסקי יופי וטיפוח בישראל",
  "נוח לשימוש גם מהנייד",
] as const;

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "פותחים חשבון ומגדירים את העסק",
    body: "שירותים, מחירים ושעות פעילות — הכול מוכן תוך דקות ספורות.",
  },
  {
    step: "2",
    title: "מנהלים תורים ולקוחות במקום אחד",
    body: "יומן ברור, כרטיסי לקוחות והיסטוריה מלאה — גם מהנייד.",
  },
  {
    step: "3",
    title: "שולחים תזכורות וממלאים את היומן",
    body: "הודעות וואטסאפ מוכנות לשליחה והמלצות שעוזרות להחזיר לקוחות.",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="app-ambient flex min-h-screen flex-col">
      {/* כותרת עליונה — המותג גלוי וברור */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)]/70 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="brand-chip flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-base font-bold">
              A
            </span>
            <div>
              <span className="text-foreground block text-lg font-bold leading-none tracking-tight">
                {BRAND.name}
              </span>
              <span className="text-muted mt-0.5 hidden text-xs sm:block">
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
              className="bg-brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-[var(--brand-shadow)] transition-opacity hover:opacity-90"
            >
              יצירת חשבון
            </Link>
          </nav>
        </div>
      </header>

      {/* אזור ראשי */}
      <main className="flex-1">
        {/* פתיח */}
        <section className="relative overflow-hidden">
          <div
            className="aura-blob float-slow pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full opacity-70"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(circle, rgba(199,111,147,0.16) 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
          />
          <div className="relative mx-auto w-full max-w-5xl px-5 pb-12 pt-14 text-center sm:px-8 sm:pb-16 sm:pt-20">
            <p className="eyebrow text-primary">{BRAND.tagline}</p>
            <h1 className="font-display text-brand-gradient mx-auto mt-4 text-6xl font-semibold tracking-tight sm:text-7xl">
              Allura
            </h1>
            <p className="text-foreground mx-auto mt-5 max-w-xl text-lg font-medium sm:text-xl">
              {BRAND_DESCRIPTION}
            </p>
            <p className="text-muted mx-auto mt-3 max-w-xl leading-relaxed">
              Allura עוזרת לבעלות עסקים בתחום היופי והטיפוח לנהל תורים, לקוחות,
              שירותים והודעות ללקוחות — בפשטות, בעברית ובמקום אחד.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="bg-brand-gradient rounded-xl px-7 py-3 text-sm font-semibold text-white shadow-[var(--brand-shadow)] transition-opacity hover:opacity-90"
              >
                יצירת חשבון
              </Link>
              <Link
                href="/login"
                className="ring-soft text-foreground rounded-xl bg-white/70 px-7 py-3 text-sm font-semibold backdrop-blur transition-colors hover:bg-white"
              >
                כניסה למערכת
              </Link>
            </div>

            {/* רצועת אמון */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
              {TRUST_POINTS.map((point) => (
                <span
                  key={point}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--primary)]/15 bg-[var(--primary)]/5 px-3.5 py-1.5"
                >
                  <CheckCircle2 className="text-primary h-3.5 w-3.5 shrink-0" />
                  <span className="text-foreground-soft text-xs font-medium">
                    {point}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* יכולות עיקריות */}
        <section className="mx-auto w-full max-w-5xl px-5 pb-16 sm:px-8">
          <div className="mb-8 text-center">
            <p className="eyebrow text-primary">מה מקבלים</p>
            <h2 className="font-display text-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              כל מה שהעסק שלך צריך, במקום אחד
            </h2>
            <div className="editorial-rule mx-auto mt-5 w-40" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="aura-card lift rounded-2xl p-5 text-start"
              >
                <span className="bg-brand-gradient flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-[var(--brand-shadow)]">
                  <feature.icon className="h-5 w-5" />
                </span>
                <h3 className="text-foreground mt-4 text-base font-semibold">
                  {feature.title}
                </h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* איך זה עובד */}
        <section className="mx-auto w-full max-w-5xl px-5 pb-16 sm:px-8">
          <div className="mb-8 text-center">
            <p className="eyebrow text-primary">איך זה עובד</p>
            <h2 className="font-display text-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              מתחילים לעבוד מסודר בשלושה צעדים
            </h2>
            <div className="editorial-rule mx-auto mt-5 w-40" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.step}
                className="ring-soft rounded-2xl bg-white/60 p-5 text-start backdrop-blur"
              >
                <span className="text-brand-gradient font-display text-3xl font-semibold">
                  {item.step}
                </span>
                <h3 className="text-foreground mt-3 text-base font-semibold">
                  {item.title}
                </h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* קריאה לפעולה */}
        <section className="mx-auto w-full max-w-5xl px-5 pb-20 sm:px-8">
          <div className="aura-card relative overflow-hidden rounded-3xl px-6 py-10 text-center sm:px-12 sm:py-12">
            <Sparkles
              className="text-accent mx-auto h-6 w-6"
              aria-hidden="true"
            />
            <h2 className="font-display text-foreground mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              מוכנה לנהל את העסק בקלות?
            </h2>
            <p className="text-muted mx-auto mt-3 max-w-md leading-relaxed">
              פתיחת חשבון לוקחת דקות ספורות — ומהרגע הראשון הכול מסודר במקום
              אחד.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="bg-brand-gradient rounded-xl px-7 py-3 text-sm font-semibold text-white shadow-[var(--brand-shadow)] transition-opacity hover:opacity-90"
              >
                יצירת חשבון
              </Link>
              <Link
                href="/login"
                className="text-primary rounded-xl px-5 py-3 text-sm font-semibold transition-colors hover:bg-[var(--primary)]/5"
              >
                כניסה למערכת
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicBrandFooter />
    </div>
  );
}
