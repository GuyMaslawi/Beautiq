import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";
import { SUBSCRIPTION } from "@/lib/constants/he";

/**
 * פס עדין בראש האפליקציה בזמן תקופת ניסיון חינם.
 *
 * בלעדיו תקופת הניסיון הייתה בלתי נראית לחלוטין: בעלת העסק נכנסת, עובדת, ויום
 * אחד פשוט מוצאת את עצמה במסך התשלום בלי שום התראה מוקדמת. הפס אומר כמה זמן
 * נשאר ומוביל למקום שבו אפשר להפעיל מנוי — לא יותר מזה, כדי לא לגזול מקום
 * מהעבודה היומית.
 */
export function TrialBanner({ daysLeft }: { daysLeft: number }) {
  // שלושת הימים האחרונים — נימה דחופה יותר, אך עדיין לא אזהרה אדומה.
  const urgent = daysLeft <= 3;

  return (
    <div
      className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-2.5"
      style={{
        background: urgent ? "rgba(198,124,58,0.10)" : "rgba(146,96,159,0.08)",
        border: `1px solid ${urgent ? "rgba(198,124,58,0.28)" : "rgba(146,96,159,0.24)"}`,
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Sparkles
          className="h-4 w-4 shrink-0"
          style={{ color: urgent ? "#b06a24" : "#92609f" }}
        />
        <p className="text-sm" style={{ color: "var(--foreground)" }}>
          <span className="font-semibold">{SUBSCRIPTION.trial.badge}</span>
          {" · "}
          {SUBSCRIPTION.trial.daysLeft(daysLeft)}
        </p>
      </div>
      <Link
        href="/settings"
        className="flex shrink-0 items-center gap-1 text-sm font-semibold hover:underline"
        style={{ color: urgent ? "#b06a24" : "#92609f" }}
      >
        {SUBSCRIPTION.trial.bannerCta}
        <ArrowLeft className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
