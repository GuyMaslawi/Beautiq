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
      <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-[var(--foreground)] sm:text-xl">
          למה לבחור בנו?
        </h2>
        <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex flex-col gap-2.5">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ background: `${brand}14`, color: brand }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-[var(--foreground)]">
                {title}
              </h3>
              <p className="text-xs leading-relaxed text-[var(--muted)]">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
