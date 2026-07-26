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

export interface AssistantFollowUp {
  intent: AssistantIntent;
  label: string;
}

export interface AssistantAnswer {
  intent: AssistantIntent | "fallback";
  title: string;
  lines: string[];
  actions: AssistantAction[];
  /** Contextual next questions, rendered as tappable chips under the answer. */
  followUps?: AssistantFollowUp[];
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

// Normalize Hebrew free text so matching is robust to niqqud, final-letter
// forms (ך→כ, ם→מ …), quotes/geresh and stray punctuation. Both the user's
// input and every keyword pass through this, so "כַּמָּה הִכְנַסְתִּי?" and
// "כמה הכנסתי" compare equal.
const FINAL_LETTERS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[֑-ׇ]/g, "") // niqqud & cantillation
    .replace(/["'׳״`]/g, "") // quotes, geresh, gershayim
    .replace(/[ךםןףץ]/g, (c) => FINAL_LETTERS[c])
    .replace(/[^֐-׿0-9a-z\s]/g, " ") // drop remaining punctuation
    .replace(/\s+/g, " ")
    .trim();
}

// Keywords are ordered most-specific → least, so equal scores tie-break toward
// the sharper intent (e.g. "כמה לקוחות בסיכון" → atRisk, not clients). A keyword
// containing a space is a phrase and scores double — a stronger signal than a
// lone word.
//
// The list is written in NATURAL Hebrew and normalized at module load (see
// NORMALIZED_INTENT_KEYWORDS below). It used to rely on each keyword being
// hand-written in already-normalized form, which is a rule that quietly decays:
// every keyword ending in a final letter — סיכון, מועדון, חלון, אנשים, תזמון —
// could never match, because norm() rewrites the incoming text to מזמנ/סיכונ
// while the keyword kept its ן. Those intents were simply unreachable through
// those words. Normalizing both sides with the same function removes the rule
// instead of restating it.
const INTENT_KEYWORDS: { intent: AssistantIntent; keywords: string[] }[] = [
  { intent: "atRisk", keywords: ["לקוחות בסיכון", "סיכון", "נטש", "נוטש", "לא חזר", "לא חוזר", "מתגעגע", "לא הגיע", "לא באה", "עזב", "ברח", "איבד", "מזמן לא"] },
  { intent: "loyalty", keywords: ["נאמנות", "מועדון", "כרטיסי", "הטבה", "הטבת", "תגמול", "מתנה", "נקודות", "punch"] },
  { intent: "emptySlots", keywords: ["חלון", "פנוי", "ריק", "זמין", "חור ביומן", "מקום פנוי", "שעות פנויות"] },
  { intent: "pricing", keywords: ["מחיר", "תמחור", "לתמחר", "יקר", "זול", "כמה לגבות", "כמה לקחת", "להעלות מחיר", "טווח שוק"] },
  { intent: "topServices", keywords: ["שירות", "טיפול", "רווחי", "פופולרי", "הכי טוב", "מכניס", "הכי מבוקש", "נמכר", "מוביל"] },
  { intent: "revenue", keywords: ["הכנס", "רווח", "כסף", "מחזור", "מכירות", "כמה עשיתי", "הרווחתי", "השתכרתי", "יעד", "כמה נכנס", "תזרים"] },
  { intent: "today", keywords: ["לעשות", "מה כדאי", "פעולה", "המלצ", "טיפ", "עדיפות", "משימ", "להתמקד", "מה חשוב", "עצה"] },
  { intent: "schedule", keywords: ["תור", "יומן", "פגיש", "לוז", "מחר", "השבוע", "היום", "מתי", "לוח זמנים", "תזמון", "כמה תורים"] },
  { intent: "clients", keywords: ["לקוח", "אנשים", "מאגר", "רשימת לקוחות", "כמה אנשים"] },
];

/**
 * The same table with every keyword passed through norm(), so both sides of the
 * comparison always live in the same alphabet. `isPhrase` is captured before
 * normalization only for readability — norm() preserves inner spaces.
 */
const NORMALIZED_INTENT_KEYWORDS = INTENT_KEYWORDS.map(({ intent, keywords }) => ({
  intent,
  keywords: keywords
    .map((k) => ({ text: norm(k), isPhrase: k.trim().includes(" ") }))
    .filter((k) => k.text.length > 0),
}));

/** Score every intent by keyword hits and return them best-first (may be empty). */
export function detectIntents(text: string): AssistantIntent[] {
  const t = norm(text);
  if (!t) return [];
  return NORMALIZED_INTENT_KEYWORDS.map(({ intent, keywords }) => {
    let score = 0;
    for (const k of keywords) if (t.includes(k.text)) score += k.isPhrase ? 2 : 1;
    return { intent, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score) // stable sort keeps array order on ties
    .map((s) => s.intent);
}

/** Best-matching business intent, or null. Kept for callers wanting a single hit. */
export function detectIntent(text: string): AssistantIntent | null {
  return detectIntents(text)[0] ?? null;
}

// Light conversational layer — greetings, thanks, "who are you", "help" — so the
// assistant feels responsive to chit-chat instead of dead-ending on a fallback.
// Only consulted when no business intent matched, so "כמה הכנסתי? תודה" still
// answers the revenue question.
type SmallTalk = "thanks" | "identity" | "help" | "greeting";
const SMALLTALK_KEYWORDS: { kind: SmallTalk; keywords: string[] }[] = [
  { kind: "thanks", keywords: ["תודה", "יופי", "מעולה", "מדהים", "אחלה", "סבבה", "כל הכבוד"] },
  { kind: "identity", keywords: ["מי את", "מי אתה", "מה את יודע", "מה אתה יודע", "מה את יכול", "מה אתה יכול", "מה זה עוזר", "מי זה"] },
  { kind: "help", keywords: ["עזרה", "עזור", "תעזר", "לא יודע", "מה לשאול", "אפשרויות", "מה אפשר", "מה יש"] },
  { kind: "greeting", keywords: ["שלום", "היי", "הלו", "אהלן", "בוקר טוב", "צהריים טובים", "ערב טוב", "מה נשמע", "מה קורה", "מה שלומ"] },
];
// Normalized for the same reason as the intent table above — so a keyword like
// "מה שלום" does not have to be hand-written as "מה שלומ" to work.
const NORMALIZED_SMALLTALK = SMALLTALK_KEYWORDS.map(({ kind, keywords }) => ({
  kind,
  keywords: keywords.map(norm).filter(Boolean),
}));

function detectSmallTalk(text: string): SmallTalk | null {
  const t = norm(text);
  if (!t) return null;
  for (const { kind, keywords } of NORMALIZED_SMALLTALK) if (keywords.some((k) => t.includes(k))) return kind;
  return null;
}

// Canonical question phrasing per intent — used as the user-bubble text when a
// follow-up chip is tapped, so the chip reads naturally as something they asked.
const INTENT_QUESTION: Record<AssistantIntent, string> = {
  revenue: "כמה הכנסתי החודש?",
  atRisk: "מי הלקוחות שבסיכון לנטוש?",
  emptySlots: "איפה יש לי חלונות פנויים?",
  today: "מה כדאי לי לעשות היום?",
  pricing: "האם המחירים שלי בסדר?",
  loyalty: "מי זכאית להטבת נאמנות?",
  clients: "כמה לקוחות יש לי?",
  topServices: "מה השירותים הכי רווחיים שלי?",
  schedule: "מה יש לי ביומן?",
};

// Which topics naturally come next after each answer.
const RELATED_INTENTS: Record<AssistantIntent, AssistantIntent[]> = {
  revenue: ["topServices", "today"],
  atRisk: ["emptySlots", "loyalty"],
  emptySlots: ["atRisk", "schedule"],
  today: ["revenue", "atRisk"],
  pricing: ["topServices", "revenue"],
  loyalty: ["atRisk", "clients"],
  clients: ["atRisk", "loyalty"],
  topServices: ["revenue", "pricing"],
  schedule: ["emptySlots", "today"],
};

function toFollowUps(intents: AssistantIntent[]): AssistantFollowUp[] {
  const seen = new Set<AssistantIntent>();
  const out: AssistantFollowUp[] = [];
  for (const i of intents) {
    if (seen.has(i)) continue;
    seen.add(i);
    out.push({ intent: i, label: INTENT_QUESTION[i] });
    if (out.length === 3) break;
  }
  return out;
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
  return { ...BUILDERS[intent](ctx), followUps: toFollowUps(RELATED_INTENTS[intent]) };
}

// Warm conversational replies for chit-chat, each nudging back toward the data.
function smallTalkAnswer(kind: SmallTalk): AssistantAnswer {
  const st = ASSISTANT.smallTalk;
  const copy: Record<SmallTalk, { title: string; body: string; topics: AssistantIntent[] }> = {
    greeting: { title: st.greetingTitle, body: st.greetingBody, topics: ["today", "revenue", "atRisk"] },
    thanks: { title: st.thanksTitle, body: st.thanksBody, topics: ["today", "emptySlots"] },
    help: { title: st.helpTitle, body: st.helpBody, topics: ["revenue", "atRisk", "emptySlots"] },
    identity: { title: st.identityTitle, body: st.identityBody, topics: ["revenue", "atRisk", "today"] },
  };
  const c = copy[kind];
  return { intent: "fallback", title: c.title, lines: [c.body], actions: [], followUps: toFollowUps(c.topics) };
}

/**
 * Answer free-text input. Business questions win first (so "כמה הכנסתי? תודה"
 * still answers revenue); a secondary detected topic becomes the lead follow-up.
 * Otherwise fall back to a friendly small-talk reply, then to a helpful default —
 * both offering tappable chips rather than a dead end.
 */
export function answerText(ctx: AssistantContext, text: string): AssistantAnswer {
  const intents = detectIntents(text);
  if (intents.length > 0) {
    const primary = intents[0];
    // Lead with any *other* topic the owner mentioned, then topical suggestions.
    const followUps = toFollowUps([...intents.slice(1), ...RELATED_INTENTS[primary]]);
    return { ...BUILDERS[primary](ctx), followUps };
  }

  const smallTalk = detectSmallTalk(text);
  if (smallTalk) return smallTalkAnswer(smallTalk);

  return {
    intent: "fallback",
    title: ASSISTANT.answers.fallbackTitle,
    lines: [ASSISTANT.answers.fallbackBody],
    actions: [],
    followUps: toFollowUps(["today", "revenue", "atRisk", "emptySlots"]),
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
