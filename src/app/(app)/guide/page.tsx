import Link from "next/link";
import {
  BookOpen,
  LayoutDashboard,
  CalendarDays,
  Users2,
  Sparkles,
  Clock,
  Globe,
  RefreshCcw,
  ListChecks,
  Gift,
  TrendingUp,
  Wallet,
  MessageCircle,
  Bot,
  Settings,
  Rocket,
  Check,
  Lightbulb,
  ChevronDown,
  ArrowLeft,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { PremiumPageShell, BeautyPageHero, EditorialSectionHeader } from "@/components/premium";
import { Section } from "@/components/ui/section";
import { GUIDE } from "@/lib/constants/guide";

export const metadata = { title: "מדריך שימוש" };

/** אייקון לכל פיצ'ר במדריך, לפי מזהה */
const FEATURE_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  bookings: CalendarDays,
  clients: Users2,
  services: Sparkles,
  availability: Clock,
  "public-page": Globe,
  "bring-back": RefreshCcw,
  waitlist: ListChecks,
  loyalty: Gift,
  "revenue-forecast": TrendingUp,
  finance: Wallet,
  whatsapp: MessageCircle,
  assistant: Bot,
  settings: Settings,
};

function GuideLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80"
      style={{ color: "var(--primary)" }}
    >
      {label}
      <ArrowLeft className="h-3.5 w-3.5" />
    </Link>
  );
}

export default function GuidePage() {
  const tocItems = [
    { href: `#${GUIDE.quickStart.id}`, label: GUIDE.quickStart.eyebrow },
    ...GUIDE.sections.map((s) => ({ href: `#${s.id}`, label: s.title })),
    { href: `#${GUIDE.faq.id}`, label: GUIDE.faq.eyebrow },
  ];

  return (
    <PremiumPageShell tint="mauve" width="default" gap="loose">
      <BeautyPageHero
        icon={BookOpen}
        eyebrow={GUIDE.eyebrow}
        title={GUIDE.pageTitle}
        subtitle={GUIDE.pageSubtitle}
        tint="mauve"
      />

      {/* תוכן עניינים */}
      <div className="aura-card rounded-2xl p-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          {GUIDE.tocTitle}
        </p>
        <div className="flex flex-wrap gap-2">
          {tocItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-primary-light"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>

      {/* התחלה מהירה */}
      <div id={GUIDE.quickStart.id} className="scroll-mt-24 space-y-5">
        <EditorialSectionHeader
          eyebrow={GUIDE.quickStart.eyebrow}
          title={GUIDE.quickStart.title}
          description={GUIDE.quickStart.description}
          icon={<Rocket className="h-3.5 w-3.5" />}
          tint="mauve"
        />
        <div className="aura-card rounded-2xl p-5 md:p-6">
          <ol className="space-y-5">
            {GUIDE.quickStart.steps.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="font-display font-semibold text-foreground">{step.title}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                    {step.body}
                  </p>
                  <GuideLink href={step.href} label={step.linkLabel} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* פרקי המדריך */}
      {GUIDE.sections.map((section) => (
        <div key={section.id} id={section.id} className="scroll-mt-24 space-y-5">
          <EditorialSectionHeader
            eyebrow={section.eyebrow}
            title={section.title}
            description={section.description}
            tint="mauve"
          />
          <div className="space-y-6">
            {section.features.map((feature) => {
              const Icon = FEATURE_ICONS[feature.id];
              return (
                <Section
                  key={feature.id}
                  title={feature.title}
                  icon={Icon ? <Icon className="h-4 w-4" style={{ color: "#ac5c7f" }} /> : undefined}
                  action={
                    feature.href && feature.linkLabel ? (
                      <GuideLink href={feature.href} label={feature.linkLabel} />
                    ) : undefined
                  }
                >
                  <div className="space-y-4">
                    <p className="text-sm leading-relaxed" style={{ color: "var(--foreground-soft)" }}>
                      {feature.body}
                    </p>
                    {feature.bullets && (
                      <ul className="space-y-2.5">
                        {feature.bullets.map((bullet) => (
                          <li key={bullet} className="flex items-start gap-2.5">
                            <Check
                              className="mt-0.5 h-4 w-4 shrink-0"
                              style={{ color: "var(--success)" }}
                            />
                            <span className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                              {bullet}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {feature.tip && (
                      <div
                        className="flex items-start gap-2.5 rounded-xl px-4 py-3"
                        style={{ background: "var(--accent-light, #f9f2e8)" }}
                      >
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} />
                        <p className="text-sm leading-relaxed" style={{ color: "var(--foreground-soft)" }}>
                          <span className="font-semibold">טיפ: </span>
                          {feature.tip}
                        </p>
                      </div>
                    )}
                  </div>
                </Section>
              );
            })}
          </div>
        </div>
      ))}

      {/* שאלות נפוצות */}
      <div id={GUIDE.faq.id} className="scroll-mt-24 space-y-5">
        <EditorialSectionHeader
          eyebrow={GUIDE.faq.eyebrow}
          title={GUIDE.faq.title}
          description={GUIDE.faq.description}
          icon={<HelpCircle className="h-3.5 w-3.5" />}
          tint="mauve"
        />
        <div className="space-y-3">
          {GUIDE.faq.items.map((item) => (
            <details key={item.q} className="aura-card group rounded-2xl px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-foreground [&::-webkit-details-marker]:hidden">
                <span>{item.q}</span>
                <ChevronDown
                  className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
                  style={{ color: "var(--muted)" }}
                />
              </summary>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>

      {/* עזרה נוספת */}
      <div
        className="rounded-[1.5rem] p-6 text-white md:p-7"
        style={{ background: "var(--brand-gradient)" }}
      >
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-semibold">{GUIDE.help.title}</h2>
            <p className="max-w-xl text-sm leading-relaxed text-white/85">{GUIDE.help.body}</p>
          </div>
          <Link
            href={GUIDE.help.contactHref}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ color: "var(--primary)" }}
          >
            {GUIDE.help.contactLabel}
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </PremiumPageShell>
  );
}
