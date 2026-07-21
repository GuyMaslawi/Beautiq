/**
 * Allura AI — a free, data-grounded business assistant.
 *
 * This is deliberately NOT an LLM: it answers questions from the owner's real
 * business data (revenue, at-risk clients, empty slots, pricing, loyalty) using
 * rule-based intent matching. That keeps it instant, private (nothing leaves the
 * server), and free forever — matching CLAUDE.md §15's rule-based mandate.
 *
 * The engine is pure and client-safe: the page fetches an `AssistantContext`
 * server-side and the client component runs `answer()` locally, so replies are
 * immediate with no round-trip.
 */
import { ASSISTANT } from "@/lib/constants/he";

export interface AssistantContext {
  businessName: string;

  // Revenue (current month)
  monthRevenue: number;
  expectedRevenue: number;
  monthlyTarget: number;
  gapToTarget: number;
  isOnTrack: boolean;
  targetReliable: boolean;
  avgBookingValue: number;
  lostRevenue: number;
  completedBookingsCount: number;

  // Services
  topServices: { name: string; revenue: number; bookingsCount: number; avgPrice: number }[];
  activeServices: number;

  // Clients
  totalClients: number;
  atRiskCount: number;
  atRiskTop: { fullName: string; daysSinceLastVisit: number }[];

  // Schedule
  bookingsToday: number;
  upcomingBookingsCount: number;
  emptySlotsCount: number;

  // Pricing
  pricingConcernCount: number;

  // Loyalty
  loyaltyConfigured: boolean;
  loyaltyEligibleCount: number;

  // Prioritized action items (rule-based guidance)
  guidance: { id: string; title: string; actionLabel: string; href: string }[];
}

export type AssistantIntent =
  | "revenue"
  | "atRisk"
  | "emptySlots"
  | "today"
  | "pricing"
  | "loyalty"
  | "clients"
  | "topServices"
  | "schedule";

export interface AssistantAction {
  label: string;
  href: string;
}

export interface AssistantAnswer {
  intent: AssistantIntent | "fallback";
  title: string;
  lines: string[];
  actions: AssistantAction[];
}

export const SUGGESTED_QUESTIONS: { intent: AssistantIntent; label: string }[] = [
  { intent: "today", label: ASSISTANT.suggestions.today },
  { intent: "revenue", label: ASSISTANT.suggestions.revenue },
  { intent: "atRisk", label: ASSISTANT.suggestions.atRisk },
  { intent: "emptySlots", label: ASSISTANT.suggestions.emptySlots },
  { intent: "pricing", label: ASSISTANT.suggestions.pricing },
  { intent: "loyalty", label: ASSISTANT.suggestions.loyalty },
  { intent: "topServices", label: ASSISTANT.suggestions.topServices },
  { intent: "clients", label: ASSISTANT.suggestions.clients },
];

export function formatILS(amount: number): string {
  return `₪${Math.round(amount).toLocaleString("he-IL")}`;
}

// Ordered most-specific → least, so "כמה לקוחות בסיכון" matches atRisk before clients.
const INTENT_KEYWORDS: { intent: AssistantIntent; keywords: string[] }[] = [
  { intent: "atRisk", keywords: ["סיכון", "נטוש", "נוטש", "ננטש", "לא חזר", "לא חוזר", "איבד", "עזב", "ברח"] },
  { intent: "loyalty", keywords: ["נאמנות", "הטבה", "הטבת", "כרטיסי", "מועדון", "punch"] },
  { intent: "emptySlots", keywords: ["חלון", "חלונות", "פנוי", "פנויים", "ריק", "זמין", "פנוייה"] },
  { intent: "pricing", keywords: ["מחיר", "מחירים", "תמחור", "יקר", "זול", "לתמחר"] },
  { intent: "topServices", keywords: ["שירות", "שירותים", "רווחי", "פופולרי", "הכי טוב", "מכניס"] },
  { intent: "revenue", keywords: ["הכנס", "הכנסתי", "רווח", "כסף", "מחזור", "כמה עשיתי", "הרווחתי", "יעד"] },
  { intent: "today", keywords: ["לעשות", "מה כדאי", "פעולה", "המלצ", "טיפ", "עדיפות"] },
  { intent: "schedule", keywords: ["תור", "תורים", "יומן", "פגיש", "לו״ז", "לוז", "מחר", "השבוע", "היום", "קבוע"] },
  { intent: "clients", keywords: ["לקוח", "לקוחות", "כמה אנשים"] },
];

export function detectIntent(text: string): AssistantIntent | null {
  const t = text.trim();
  if (!t) return null;
  for (const { intent, keywords } of INTENT_KEYWORDS) {
    if (keywords.some((k) => t.includes(k))) return intent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Answer builders
// ---------------------------------------------------------------------------

function answerRevenue(ctx: AssistantContext): AssistantAnswer {
  const lines: string[] = [];
  if (ctx.completedBookingsCount > 0 || ctx.monthRevenue > 0) {
    lines.push(`החודש הכנסת ${formatILS(ctx.monthRevenue)} מ-${ctx.completedBookingsCount} תורים שהושלמו.`);
    lines.push(`הצפי לסוף החודש: ${formatILS(ctx.expectedRevenue)} (כולל תורים שכבר קבועים).`);
    if (ctx.targetReliable && ctx.monthlyTarget > 0) {
      lines.push(
        ctx.isOnTrack
          ? `את בדרך ליעד החודשי (${formatILS(ctx.monthlyTarget)}) — מצוין! 🎯`
          : `נותרו ${formatILS(ctx.gapToTarget)} כדי להגיע ליעד החודשי (${formatILS(ctx.monthlyTarget)}).`,
      );
    }
    if (ctx.avgBookingValue > 0) lines.push(`הערך הממוצע לתור: ${formatILS(ctx.avgBookingValue)}.`);
    if (ctx.lostRevenue > 0) lines.push(`⚠️ ${formatILS(ctx.lostRevenue)} אבדו החודש מביטולים ואי-הגעות.`);
  } else {
    lines.push("עדיין אין תורים שהושלמו החודש, אז אין נתוני הכנסה להציג. ברגע שתסמני תורים כ״הושלם״ — אעדכן אותך כאן.");
  }
  return {
    intent: "revenue",
    title: "ההכנסות שלך",
    lines,
    actions: [
      { label: "תחזית הכנסות", href: "/revenue-forecast" },
      { label: "פיננסים", href: "/finance" },
    ],
  };
}

function answerAtRisk(ctx: AssistantContext): AssistantAnswer {
  const lines: string[] = [];
  if (ctx.atRiskCount === 0) {
    lines.push("אין כרגע לקוחות בסיכון נטישה — הלקוחות שלך חוזרות בקביעות. כל הכבוד! 👏");
  } else {
    lines.push(`יש ${ctx.atRiskCount} לקוחות שלא חזרו מזמן ואין להן תור עתידי.`);
    for (const c of ctx.atRiskTop) {
      lines.push(`• ${c.fullName} — ${c.daysSinceLastVisit} ימים מאז הביקור האחרון`);
    }
    lines.push("שווה לשלוח להן הודעת ״מתגעגעים״ ולהציע תור.");
  }
  return {
    intent: "atRisk",
    title: "לקוחות בסיכון נטישה",
    lines,
    actions: [
      { label: "החזרת לקוחות", href: "/bring-back" },
      { label: "לקוחות בסיכון", href: "/at-risk" },
    ],
  };
}

function answerEmptySlots(ctx: AssistantContext): AssistantAnswer {
  const lines: string[] =
    ctx.emptySlotsCount === 0
      ? ["היומן שלך מלא יפה בשבוע הקרוב — אין חלונות פנויים בולטים למלא."]
      : [
          `יש ${ctx.emptySlotsCount} חלונות פנויים בשבוע הקרוב.`,
          "כל חלון פנוי זה הכנסה שממתינה — שווה להציע אותם ללקוחות שמחכות או לכאלה שלא הגיעו מזמן.",
        ];
  return {
    intent: "emptySlots",
    title: "חלונות פנויים",
    lines,
    actions: [
      { label: "חלונות פנויים", href: "/empty-slots" },
      { label: "רשימת המתנה", href: "/waitlist" },
    ],
  };
}

function answerToday(ctx: AssistantContext): AssistantAnswer {
  const lines: string[] = [];
  if (ctx.bookingsToday > 0) lines.push(`היום יש לך ${ctx.bookingsToday} תורים ביומן.`);
  const actions: AssistantAction[] = [];
  for (const g of ctx.guidance.slice(0, 3)) {
    lines.push(`• ${g.title}`);
    actions.push({ label: g.actionLabel, href: g.href });
  }
  if (lines.length === 0) lines.push(ASSISTANT.answers.noAction);
  return { intent: "today", title: "מה כדאי לעשות היום", lines, actions: actions.slice(0, 3) };
}

function answerPricing(ctx: AssistantContext): AssistantAnswer {
  const lines: string[] =
    ctx.pricingConcernCount > 0
      ? [
          `יש ${ctx.pricingConcernCount} שירותים שמתומחרים מתחת לטווח השוק שהגדרת.`,
          "העלאת מחיר קטנה בשירותים האלה יכולה להגדיל את ההכנסה בלי יותר עבודה.",
        ]
      : ["המחירים שלך נראים תקינים ביחס לטווחי השוק שהגדרת 👌"];
  if (ctx.topServices.length > 0) {
    const t = ctx.topServices[0];
    lines.push(`השירות המוביל שלך, ${t.name}, במחיר ממוצע של ${formatILS(t.avgPrice)} לתור.`);
  }
  return {
    intent: "pricing",
    title: "המחירים שלך",
    lines,
    actions: [
      { label: "תובנות מחיר", href: "/pricing" },
      { label: "שירותים", href: "/services" },
    ],
  };
}

function answerLoyalty(ctx: AssistantContext): AssistantAnswer {
  let lines: string[];
  if (!ctx.loyaltyConfigured) {
    lines = [
      "עדיין לא הגדרת מועדון נאמנות.",
      "אפשר להפעיל כרטיסיית ביקורים שמתגמלת לקוחות חוזרות — למשל הטבה כל 10 ביקורים. זו דרך פשוטה להחזיר לקוחות שוב ושוב.",
    ];
  } else if (ctx.loyaltyEligibleCount > 0) {
    lines = [
      `יש ${ctx.loyaltyEligibleCount} לקוחות שזכאיות להטבת נאמנות עכשיו! 🎁`,
      "שווה לשלוח להן הודעה, לממש את ההטבה ולהזמין אותן שוב.",
    ];
  } else {
    lines = ["אף לקוחה לא השלימה כרטיסייה עדיין. ככל שהלקוחות יחזרו — הן יתקדמו אוטומטית להטבה."];
  }
  return { intent: "loyalty", title: "מועדון הנאמנות", lines, actions: [{ label: "מועדון נאמנות", href: "/loyalty" }] };
}

function answerClients(ctx: AssistantContext): AssistantAnswer {
  const lines = [`יש לך ${ctx.totalClients} לקוחות במערכת ו-${ctx.activeServices} שירותים פעילים.`];
  if (ctx.atRiskCount > 0) lines.push(`מתוכן, ${ctx.atRiskCount} בסיכון נטישה — כדאי להחזיר אותן.`);
  return { intent: "clients", title: "הלקוחות שלך", lines, actions: [{ label: "לקוחות", href: "/clients" }] };
}

function answerTopServices(ctx: AssistantContext): AssistantAnswer {
  if (ctx.topServices.length === 0) {
    return {
      intent: "topServices",
      title: "השירותים הרווחיים",
      lines: ["עוד אין מספיק תורים שהושלמו החודש כדי לדעת מה הכי רווחי."],
      actions: [{ label: "שירותים", href: "/services" }],
    };
  }
  const lines = ["השירותים שהכניסו הכי הרבה החודש:"];
  ctx.topServices.slice(0, 3).forEach((s, i) => {
    lines.push(`${i + 1}. ${s.name} — ${formatILS(s.revenue)} מ-${s.bookingsCount} תורים`);
  });
  return {
    intent: "topServices",
    title: "השירותים הרווחיים",
    lines,
    actions: [
      { label: "תחזית הכנסות", href: "/revenue-forecast" },
      { label: "שירותים", href: "/services" },
    ],
  };
}

function answerSchedule(ctx: AssistantContext): AssistantAnswer {
  const lines: string[] = [];
  if (ctx.bookingsToday > 0) lines.push(`היום יש לך ${ctx.bookingsToday} תורים ביומן.`);
  else lines.push("אין לך תורים היום.");

  if (ctx.upcomingBookingsCount > 0) {
    lines.push(`בסך הכול ${ctx.upcomingBookingsCount} תורים עתידיים קבועים ביומן.`);
  } else {
    lines.push("אין תורים עתידיים קבועים כרגע — הזדמנות טובה לפנות ללקוחות ולמלא את היומן.");
  }

  if (ctx.emptySlotsCount > 0) {
    lines.push(`יש גם ${ctx.emptySlotsCount} חלונות פנויים השבוע שאפשר למלא.`);
  }

  return {
    intent: "schedule",
    title: "היומן שלך",
    lines,
    actions: [
      { label: "התורים שלי", href: "/bookings" },
      { label: "חלונות פנויים", href: "/empty-slots" },
    ],
  };
}

const BUILDERS: Record<AssistantIntent, (ctx: AssistantContext) => AssistantAnswer> = {
  revenue: answerRevenue,
  atRisk: answerAtRisk,
  emptySlots: answerEmptySlots,
  today: answerToday,
  pricing: answerPricing,
  loyalty: answerLoyalty,
  clients: answerClients,
  topServices: answerTopServices,
  schedule: answerSchedule,
};

export function answerIntent(ctx: AssistantContext, intent: AssistantIntent): AssistantAnswer {
  return BUILDERS[intent](ctx);
}

/** Answer free-text input: detect intent, else return a helpful fallback. */
export function answerText(ctx: AssistantContext, text: string): AssistantAnswer {
  const intent = detectIntent(text);
  if (intent) return BUILDERS[intent](ctx);
  return {
    intent: "fallback",
    title: ASSISTANT.answers.fallbackTitle,
    lines: [ASSISTANT.answers.fallbackBody, ...SUGGESTED_QUESTIONS.map((q) => `• ${q.label}`)],
    actions: [],
  };
}

/** Build the proactive daily briefing lines from the context (may be empty). */
export function buildBriefing(ctx: AssistantContext): string[] {
  const hasData = ctx.totalClients > 0 || ctx.completedBookingsCount > 0 || ctx.bookingsToday > 0;
  if (!hasData) return [];

  const lines: string[] = [];

  if (ctx.completedBookingsCount > 0 || ctx.monthRevenue > 0) {
    let rev = `החודש הכנסת ${formatILS(ctx.monthRevenue)}`;
    if (ctx.targetReliable && ctx.monthlyTarget > 0) {
      rev += ctx.isOnTrack ? " — את בדרך ליעד! 🎯" : `, נותרו ${formatILS(ctx.gapToTarget)} ליעד החודשי.`;
    } else {
      rev += ".";
    }
    lines.push(rev);
  }

  if (ctx.bookingsToday > 0) lines.push(`היום יש לך ${ctx.bookingsToday} תורים ביומן.`);
  else if (ctx.upcomingBookingsCount === 0 && ctx.activeServices > 0) {
    lines.push("אין תורים קבועים כרגע — הזדמנות טובה לפנות ללקוחות ולמלא את היומן.");
  }

  if (ctx.atRiskCount > 0) lines.push(`${ctx.atRiskCount} לקוחות בסיכון נטישה — כדאי להחזיר אותן.`);
  if (ctx.emptySlotsCount > 0) lines.push(`${ctx.emptySlotsCount} חלונות פנויים השבוע ממתינים למילוי.`);
  if (ctx.loyaltyEligibleCount > 0) lines.push(`${ctx.loyaltyEligibleCount} לקוחות זכאיות להטבת נאמנות 🎁`);

  return lines.slice(0, 4);
}
