import Link from "next/link";
import {
  Crown,
  Sparkles,
  Check,
  Clock,
  MessageCircle,
  HeartHandshake,
  BadgeCheck,
  TrendingUp,
  CalendarDays,
  Users2,
  Zap,
  Shield,
  Bot,
  BarChart3,
  Star,
  Rocket,
  Flower2,
  Gem,
  HelpCircle,
} from "lucide-react";
import { PremiumPageShell, EditorialSectionHeader } from "@/components/premium";

const BASIS_FEATURES = [
  "לוח שנה לתורים",
  "ניהול לקוחות (CRM)",
  "ניהול שירותים ומחירים",
  "שעות פעילות",
  "דף הזמנות ציבורי",
  "הודעות WhatsApp מוכנות לשליחה",
  "ניהול מקדמות",
  "ניהול ביטולים ואי-הגעה",
  "מרכז שימור לקוחות",
  "זיהוי חלונות פנויים",
  "תובנות מחירים",
  "ביקורות ומוניטין",
  "המלצות עסקיות חכמות",
];

const PRO_FEATURES: { text: string; isNew?: boolean }[] = [
  { text: "לקוחות בסיכון — זיהוי לקוחות שעלולים לא לחזור", isNew: true },
  { text: "תחזית הכנסות — צפי חודשי, יעד, פער, המלצות לסגירת פער", isNew: true },
  { text: "עוזר AI חכם לניהול העסק" },
  { text: "קמפיינים אוטומטיים ללקוחות" },
  { text: "ניהול צוות ועובדים" },
  { text: "חיזוי נטישת לקוחות" },
  { text: "מועדון נאמנות" },
  { text: "ניתוח עסקי מתקדם" },
  { text: "המלצות מחירים חכמות (AI)" },
  { text: "דף עסק ציבורי מתקדם" },
];

const VALUE_PROPS = [
  { icon: CalendarDays, text: "יותר סדר ביומן" },
  { icon: Users2, text: "יותר לקוחות חוזרות" },
  { icon: MessageCircle, text: "פחות הודעות ידניות" },
  { icon: BadgeCheck, text: "יותר מקצועיות" },
  { icon: HeartHandshake, text: "פחות ביטולים" },
];

const FAQS = [
  {
    q: "האם אפשר לבטל בכל רגע?",
    a: "כן, בהחלט. אין התחייבות וניתן לבטל את המנוי בכל רגע ללא עמלות ביטול.",
  },
  {
    q: "האם המערכת מתאימה לעסק קטן?",
    a: "בהחלט — Allura תוכננה בדיוק עבור בעלות עסקים קטנים בתחום היופי. פשוטה, ידידותית ומהירה לשימוש.",
  },
  {
    q: "האם דף ההזמנות הציבורי כלול?",
    a: "כן, דף ההזמנות הציבורי כלול בתוכנית הבסיס.",
  },
  {
    q: "מה כבר כלול ב-Allura Pro?",
    a: "כבר עכשיו: לקוחות בסיכון — זיהוי לקוחות שעלולים לא לחזור. תחזית הכנסות — צפי חודשי, יעד, פער והמלצות לסגירת הפער. שאר הפיצ׳רים בפיתוח פעיל.",
  },
  {
    q: "מה הכוונה ב'בקרוב' ב-Pro?",
    a: "כל הפיצ׳רים של Allura Pro נמצאים בפיתוח פעיל. הם יופעלו אוטומטית לכל מנויי ה-Pro ברגע שיושקו.",
  },
];

export default function PlansPage() {
  return (
    <PremiumPageShell tint="champagne" width="default" gap="loose" className="pb-16">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-8"
        style={{
          background:
            "linear-gradient(135deg, #4c1535 0%, #6b1e48 40%, #3a0e27 100%)",
          boxShadow: "0 8px 40px rgba(76,21,53,0.35)",
        }}
      >
        <div
          className="pointer-events-none absolute -top-20 -right-20 h-80 w-80 rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle, rgba(212,168,83,0.6) 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full opacity-15"
          style={{
            background:
              "radial-gradient(circle, rgba(172,92,127,0.8) 0%, transparent 70%)",
          }}
        />

        <div className="relative">
          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(212,168,83,0.30) 0%, rgba(192,149,96,0.20) 100%)",
              border: "1px solid rgba(212,168,83,0.40)",
              boxShadow: "0 4px 20px rgba(212,168,83,0.25)",
            }}
          >
            <Crown className="h-8 w-8" style={{ color: "#d4a853" }} />
          </div>

          <h1 className="font-display mb-4 text-3xl font-semibold leading-tight tracking-tight text-white md:text-4xl">
            הכלים שאת צריכה — כבר כאן
            <br />
            <span style={{ color: "#d4a853" }}>תוכנית בסיס מלאה ב-₪149 בלבד</span>
          </h1>

          <p
            className="mx-auto max-w-xl text-base leading-7"
            style={{ color: "rgba(255,255,255,0.70)" }}
          >
            ניהול תורים, לקוחות, שירותים, מקדמות, שימור ותובנות — במקום אחד, בעברית מלאה.
            <br />
            פחות עבודה ידנית, יותר לקוחות מרוצות.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            {VALUE_PROPS.map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: "#d4a853" }} />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="space-y-5">
        <EditorialSectionHeader
          eyebrow="המסלולים של Allura"
          title="תוכניות"
          description="מסלול אחד פשוט שכולל הכול — ו-Pro שמגיע בקרוב"
          icon={<Crown className="h-3.5 w-3.5" />}
          tint="champagne"
        />

        <div className="grid gap-5 md:grid-cols-2">
          {/* ── בסיס ── */}
          <div
            className="relative flex flex-col rounded-3xl p-7"
            style={{
              background: "rgba(255,255,255,0.97)",
              border: "2px solid rgba(172,92,127,0.30)",
              boxShadow:
                "0 4px 24px rgba(172,92,127,0.14), 0 1px 4px rgba(43,37,48,0.06)",
            }}
          >
            {/* Badge */}
            <div
              className="absolute -top-3.5 right-6 rounded-full px-4 py-1 text-xs font-bold whitespace-nowrap"
              style={{
                background: "var(--brand-gradient)",
                color: "#ffffff",
                boxShadow: "0 2px 8px rgba(172,92,127,0.35)",
              }}
            >
              ✦ התוכנית הנוכחית שלך
            </div>

            {/* Header */}
            <div className="mb-6 mt-1">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{
                    background: "rgba(172,92,127,0.12)",
                    border: "1px solid rgba(172,92,127,0.22)",
                  }}
                >
                  <Flower2 className="h-4 w-4" style={{ color: "var(--primary)" }} />
                </span>
                <h3 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                  בסיס
                </h3>
              </div>
              <p className="mb-4 text-sm leading-5" style={{ color: "var(--muted)" }}>
                הפתרון המלא לניהול העסק — כל מה שצריך, כבר פה
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold tabular-nums" style={{ color: "var(--primary)" }}>
                  ₪149
                </span>
                <span className="text-sm" style={{ color: "var(--muted)" }}>
                  / לחודש
                </span>
              </div>
            </div>

            {/* CTA */}
            <div className="mb-6">
              <button
                disabled
                className="flex w-full cursor-default items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold"
                style={{
                  background: "rgba(172,92,127,0.10)",
                  border: "1px solid rgba(172,92,127,0.25)",
                  color: "var(--primary)",
                }}
              >
                <Check className="h-4 w-4" />
                פעיל — התוכנית שלי
              </button>
            </div>

            {/* Features */}
            <ul className="flex flex-col gap-2.5">
              {BASIS_FEATURES.map((text) => (
                <li key={text} className="flex items-center gap-2.5">
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: "rgba(172,92,127,0.12)",
                      border: "1px solid rgba(172,92,127,0.22)",
                    }}
                  >
                    <Check className="h-3 w-3" style={{ color: "var(--primary)" }} />
                  </div>
                  <span className="text-sm leading-5" style={{ color: "var(--foreground)" }}>
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Allura Pro ── */}
          <div
            className="relative flex flex-col rounded-3xl p-7"
            style={{
              background:
                "linear-gradient(160deg, #2e0d20 0%, #4c1535 50%, #3a0e27 100%)",
              border: "1.5px solid rgba(212,168,83,0.35)",
              boxShadow:
                "0 8px 40px rgba(76,21,53,0.30), 0 0 0 1px rgba(212,168,83,0.10)",
            }}
          >
            {/* Badge */}
            <div
              className="absolute -top-3.5 right-6 flex items-center gap-1.5 rounded-full px-4 py-1 text-xs font-bold whitespace-nowrap"
              style={{
                background: "linear-gradient(135deg, #d4a853 0%, #c09560 100%)",
                color: "#3a2200",
                boxShadow: "0 2px 10px rgba(212,168,83,0.45)",
              }}
            >
              <Rocket className="h-3 w-3" />
              בקרוב
            </div>

            {/* Header */}
            <div className="mb-6 mt-1">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{
                    background: "rgba(212,168,83,0.18)",
                    border: "1px solid rgba(212,168,83,0.35)",
                  }}
                >
                  <Gem className="h-4 w-4" style={{ color: "#d4a853" }} />
                </span>
                <h3 className="text-xl font-bold text-white">
                  Allura Pro
                </h3>
              </div>
              <p
                className="mb-4 text-sm leading-5"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                הכלים המתקדמים של Allura — הראשון כבר פעיל
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold tabular-nums" style={{ color: "#d4a853" }}>
                  ₪199
                </span>
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                  / לחודש
                </span>
              </div>
            </div>

            {/* CTA */}
            <div className="mb-6">
              <Link
                href="/contact"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold transition-opacity hover:opacity-90"
                style={{
                  background: "linear-gradient(135deg, #d4a853 0%, #c09560 100%)",
                  color: "#3a2200",
                  boxShadow: "0 3px 14px rgba(212,168,83,0.40)",
                }}
              >
                <Sparkles className="h-4 w-4" />
                עדכני אותי כשיצא
              </Link>
            </div>

            {/* Pro features */}
            <ul className="flex flex-col gap-2.5">
              {PRO_FEATURES.map(({ text, isNew }) => (
                <li key={text} className="flex items-center gap-2.5">
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: isNew ? "rgba(172,92,127,0.20)" : "rgba(212,168,83,0.15)",
                      border: `1px solid ${isNew ? "rgba(172,92,127,0.40)" : "rgba(212,168,83,0.30)"}`,
                    }}
                  >
                    {isNew ? (
                      <Check className="h-3 w-3" style={{ color: "#c76f93" }} />
                    ) : (
                      <Clock className="h-3 w-3" style={{ color: "#d4a853" }} />
                    )}
                  </div>
                  <span className="flex items-center gap-2 text-sm leading-5">
                    <span style={{ color: isNew ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.75)" }}>
                      {text}
                    </span>
                    {isNew ? (
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: "rgba(172,92,127,0.25)",
                          color: "#e8a4c0",
                          border: "1px solid rgba(172,92,127,0.40)",
                        }}
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        חדש
                      </span>
                    ) : (
                      <span
                        className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: "rgba(212,168,83,0.15)",
                          color: "#d4a853",
                          border: "1px solid rgba(212,168,83,0.25)",
                        }}
                      >
                        בקרוב
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            {/* Bottom note */}
            <p
              className="mt-6 text-center text-xs"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              כל הפיצ׳רים יופעלו אוטומטית עם ההשקה
            </p>
          </div>
        </div>

        <p className="text-center text-xs" style={{ color: "var(--muted)" }}>
          ✦ ביטול בכל רגע ✦ ללא התחייבות ✦ תמיכה בעברית
        </p>
      </div>

      {/* Why Allura */}
      <div className="space-y-5">
        <EditorialSectionHeader
          eyebrow="הערך שכבר אצלך"
          title="מה כבר עובד בשבילך היום"
          description="הכלים שכלולים בתוכנית הבסיס ומלווים אותך כל יום"
          icon={<Sparkles className="h-3.5 w-3.5" />}
          tint="rose"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: HeartHandshake,
              title: "פחות ביטולים",
              body: "הודעות WhatsApp מוכנות לשליחה שעוזרות להפחית ביטולים ולחסוך זמן יקר.",
            },
            {
              icon: CalendarDays,
              title: "יותר סדר ביומן",
              body: "יומן חכם שמנהל את הזמן שלך כך שלא תפספסי שום תור.",
            },
            {
              icon: Users2,
              title: "יותר לקוחות חוזרות",
              body: "מרכז שימור לקוחות שמזכיר לך לחזור ולפנות ללקוחות שנעלמו.",
            },
            {
              icon: TrendingUp,
              title: "תובנות מחירים",
              body: "ניתוח מחירים ורווחיות שעוזר לקבל החלטות נכונות על כל שירות.",
            },
            {
              icon: Star,
              title: "ביקורות ומוניטין",
              body: "כלים לבקשת ביקורות ולשמירה על המוניטין של העסק ברשת.",
            },
            {
              icon: Zap,
              title: "חלונות פנויים",
              body: "זיהוי אוטומטי של חלונות פנויים עם הצעות ללקוחות שיכולות למלא אותם.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="aura-card lift rounded-[1.4rem] p-5"
            >
              <div
                className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(199,111,147,0.14) 0%, rgba(172,92,127,0.08) 100%)",
                  border: "1px solid rgba(172,92,127,0.18)",
                }}
              >
                <Icon className="h-4 w-4" style={{ color: "var(--primary)" }} />
              </div>
              <h3
                className="mb-1 text-sm font-bold"
                style={{ color: "var(--foreground)" }}
              >
                {title}
              </h3>
              <p className="text-sm leading-5" style={{ color: "var(--muted)" }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Pro teaser */}
      <div
        className="relative overflow-hidden rounded-3xl px-6 py-10 sm:px-8"
        style={{
          background: "linear-gradient(135deg, #2e0d20 0%, #4c1535 60%, #3a0e27 100%)",
          border: "1px solid rgba(212,168,83,0.25)",
          boxShadow: "0 6px 32px rgba(76,21,53,0.28)",
        }}
      >
        <div
          className="pointer-events-none absolute -top-12 -left-12 h-48 w-48 rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle, rgba(212,168,83,0.6) 0%, transparent 70%)",
          }}
        />
        <div className="relative flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: "rgba(212,168,83,0.18)",
                border: "1px solid rgba(212,168,83,0.35)",
              }}
            >
              <Bot className="h-6 w-6" style={{ color: "#d4a853" }} />
            </div>
            <div>
              <p
                className="mb-1 text-xs font-semibold uppercase tracking-wide"
                style={{ color: "rgba(212,168,83,0.70)" }}
              >
                Allura Pro — בפיתוח
              </p>
              <h3 className="mb-1.5 text-lg font-bold text-white">
                עוזר AI חכם לניהול העסק שלך
              </h3>
              <p className="text-sm leading-6" style={{ color: "rgba(255,255,255,0.55)" }}>
                קמפיינים אוטומטיים, תחזית הכנסות, חיזוי נטישה ועוד — כל הכלים שיהפכו את
                Allura לעוזר העסקי החכם שלך.
              </p>
            </div>
          </div>
          <Link
            href="/contact"
            className="flex shrink-0 items-center gap-1.5 rounded-xl px-6 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #d4a853 0%, #c09560 100%)",
              color: "#3a2200",
              boxShadow: "0 3px 12px rgba(212,168,83,0.35)",
            }}
          >
            <Sparkles className="h-4 w-4" />
            עדכני אותי
          </Link>
        </div>
      </div>

      {/* FAQ */}
      <div className="space-y-5">
        <EditorialSectionHeader
          eyebrow="לפני שמחליטים"
          title="שאלות נפוצות"
          description="התשובות לשאלות שהכי חשוב לדעת"
          icon={<HelpCircle className="h-3.5 w-3.5" />}
          tint="mauve"
        />
        <div className="space-y-3">
          {FAQS.map(({ q, a }) => (
            <div key={q} className="aura-card rounded-[1.4rem] p-5">
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(199,111,147,0.18) 0%, rgba(172,92,127,0.11) 100%)",
                    color: "var(--primary)",
                    border: "1px solid rgba(172,92,127,0.20)",
                  }}
                >
                  ?
                </div>
                <div>
                  <p
                    className="mb-1.5 font-semibold text-sm"
                    style={{ color: "var(--foreground)" }}
                  >
                    {q}
                  </p>
                  <p className="text-sm leading-6" style={{ color: "var(--muted)" }}>
                    {a}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div
        className="relative overflow-hidden rounded-3xl px-6 py-12 text-center sm:px-8"
        style={{
          background:
            "linear-gradient(135deg, rgba(247,238,243,0.95) 0%, rgba(255,248,253,0.95) 100%)",
          border: "1px solid rgba(172,92,127,0.22)",
          boxShadow: "0 4px 24px rgba(172,92,127,0.12)",
        }}
      >
        <div
          className="pointer-events-none absolute -top-10 -left-10 h-48 w-48 rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle, rgba(212,168,83,0.4) 0%, transparent 70%)",
          }}
        />
        <Sparkles className="mx-auto mb-4 h-8 w-8" style={{ color: "var(--primary)" }} />
        <h2 className="font-display mb-3 text-2xl font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
          הכל כבר מוכן בשבילך
        </h2>
        <p
          className="mx-auto mb-8 max-w-sm text-sm leading-6"
          style={{ color: "var(--muted)" }}
        >
          תוכנית הבסיס כוללת את כל הכלים שאת צריכה לנהל את העסק שלך היום.
          Allura Pro מגיע בקרוב עם עוד.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-opacity hover:opacity-90"
            style={{
              background: "var(--brand-gradient)",
              color: "#ffffff",
              boxShadow: "0 3px 14px rgba(172,92,127,0.35)",
            }}
          >
            <BarChart3 className="h-4 w-4" />
            חזרי ללוח הבקרה
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors hover:bg-background-alt"
            style={{
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              background: "rgba(255,255,255,0.80)",
            }}
          >
            <Shield className="h-4 w-4" style={{ color: "var(--muted)" }} />
            הגדרות העסק
          </Link>
        </div>
        <p className="mt-5 text-xs" style={{ color: "var(--muted-light)" }}>
          ✦ ללא התחייבות ✦ ביטול בכל רגע ✦ תמיכה בעברית
        </p>
      </div>
    </PremiumPageShell>
  );
}
