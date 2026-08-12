import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  HeartHandshake,
  MessageCircle,
  TrendingUp,
} from "lucide-react";
import { BRAND } from "@/lib/constants/he";
import { LaunchCountdown } from "./countdown";

// עמוד פתיחת העונה — עמוד ראווה ציבורי לרגע ההשקה.
// הוא חי מחוץ למעטפת האפליקציה בכוונה: רקע כהה, ספירה לאחור וקריאה לפעולה.
export const metadata: Metadata = {
  title: "פתיחת העונה · Allura",
  description:
    "פותחים עונה רשמית. Allura — ניהול תורים, לקוחות והודעות לעסקי יופי וטיפוח, במקום אחד.",
  alternates: { canonical: "/launch" },
  openGraph: {
    title: "פתיחת העונה · Allura",
    description: "יום חמישי, 13 באוגוסט, בשעה 19:00. העונה נפתחת.",
    locale: "he_IL",
    type: "website",
  },
};

const HIGHLIGHTS = [
  {
    icon: CalendarDays,
    title: "יומן שמסתדר לבד",
    body: "תורים, אישורים וביטולים במסך אחד ברור — גם מהנייד.",
  },
  {
    icon: MessageCircle,
    title: "הודעות שנשלחות בזמן",
    body: "אישור תור, תזכורת ותודה אחרי הטיפול — בוואטסאפ, בעברית.",
  },
  {
    icon: HeartHandshake,
    title: "לקוחות שחוזרות",
    body: "מי לא חזרה כבר חודש, למי כדאי להזכיר, ומה לשלוח לה.",
  },
  {
    icon: TrendingUp,
    title: "לראות את המספרים",
    body: "הכנסות, חלונות פנויים והמלצות פעולה ליום הקרוב.",
  },
] as const;

export default function LaunchPage() {
  return (
    <div className="launch-night relative flex min-h-dvh flex-col overflow-hidden">
      {/* הילות רקע מונפשות */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="launch-aura launch-aura-1" />
        <div className="launch-aura launch-aura-2" />
        <div className="launch-aura launch-aura-3" />
        <div className="launch-grain absolute inset-0" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/about" className="flex items-center gap-3">
          <span className="brand-chip flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-base font-bold">
            A
          </span>
          <span className="text-lg font-bold leading-none tracking-tight text-white">
            {BRAND.name}
          </span>
        </Link>
        <span className="hidden text-sm text-white/55 sm:block">
          {BRAND.tagline}
        </span>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-5 pb-16 pt-6 text-center sm:px-8 sm:pt-12">
        <span className="launch-eyebrow inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-[0.18em] text-white/85 sm:text-sm">
          פתיחת עונה רשמית
        </span>

        <h1 className="mt-7 text-5xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-7xl md:text-8xl">
          העונה
          <br className="sm:hidden" />{" "}
          <span className="text-brand-gradient-bright launch-shine">
            נפתחת
          </span>
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70 sm:text-xl">
          יום חמישי, 13 באוגוסט, בשעה 19:00.
          <br className="hidden sm:block" /> מכאן העסק שלך עובד מסודר — יומן,
          לקוחות והודעות במקום אחד.
        </p>

        <div className="mt-12 w-full sm:mt-14">
          <LaunchCountdown />
        </div>

        {/* מה מחכה בפנים */}
        <div className="mt-20 grid w-full max-w-5xl gap-3 sm:mt-24 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {HIGHLIGHTS.map((item) => (
            <div
              key={item.title}
              className="launch-card flex flex-col items-center rounded-2xl px-5 py-7 text-center"
            >
              <span className="launch-card-icon flex h-11 w-11 items-center justify-center rounded-2xl">
                <item.icon className="h-5 w-5 text-white" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-base font-bold text-white">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-10 text-center sm:px-8">
        <div className="launch-hairline mx-auto mb-6 w-full max-w-5xl" />
        <p className="text-sm text-white/45">
          {BRAND.name} · {BRAND.tagline}
        </p>
      </footer>
    </div>
  );
}
