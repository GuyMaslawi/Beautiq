import { Sparkles, Award, Gem, Heart } from "lucide-react";

const BENEFITS = [
  {
    icon: Sparkles,
    title: "שירות אישי ומותאם",
    text: "הקשבה, ייעוץ ותוצאה שמתאימה בדיוק לך.",
  },
  {
    icon: Award,
    title: "ניסיון ומקצועיות",
    text: "צוות מנוסה עם תשומת לב לכל פרט.",
  },
  {
    icon: Gem,
    title: "מוצרים איכותיים",
    text: "עבודה עם חומרים ומותגים מובילים.",
  },
  {
    icon: Heart,
    title: "אווירה נעימה ומפנקת",
    text: "סביבה נקייה, פרטית ומרגיעה.",
  },
] as const;

export function PublicTrustSection({ brand }: { brand: string }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <div className="mb-6 text-center">
        <span
          className="eyebrow"
          style={{ color: brand }}
        >
          החוויה אצלנו
        </span>
        <h2 className="text-foreground mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">
          למה לבחור בנו?
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="lift group relative overflow-hidden rounded-[1.4rem] p-5 text-center sm:text-right"
            style={{
              background: "linear-gradient(168deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.82) 100%)",
              border: "1px solid rgba(255,255,255,0.7)",
              boxShadow: "0 10px 30px -16px rgba(124,58,97,0.18), inset 0 1px 0 rgba(255,255,255,0.9)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-8 h-24 w-24 rounded-full opacity-60"
              style={{ insetInlineEnd: "-1rem", background: `radial-gradient(circle, ${brand}26 0%, transparent 70%)`, filter: "blur(10px)" }}
            />
            <div
              className="relative mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-white sm:mx-0"
              style={{ background: `linear-gradient(135deg, ${brand}, ${brand}aa)`, boxShadow: `0 10px 22px -8px ${brand}88` }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-foreground relative text-sm font-bold">{title}</h3>
            <p className="relative mt-1 text-xs leading-relaxed text-[var(--muted)]">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
