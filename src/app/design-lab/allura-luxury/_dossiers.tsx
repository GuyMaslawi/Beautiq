/*
 * Design-language dossiers — the written rationale behind each concept.
 * Visual language · typography · palette · motion · "why a million-shekel product".
 */
import { Eyebrow } from "./_ui";

export type Dossier = {
  id: "command" | "concierge" | "cockpit";
  index: string;
  nameHe: string;
  nameEn: string;
  tagline: string;
  essence: string;
  visualLanguage: string[];
  typography: { role: string; font: string }[];
  palette: { name: string; value: string; ink?: boolean }[];
  motion: string;
  million: string;
};

export const dossiers: Dossier[] = [
  {
    id: "command",
    index: "01",
    nameHe: "מרכז השליטה",
    nameEn: "Luxury Beauty Command Center",
    tagline: "מערכת הפעלה רבת־עוצמה לבעלת העסק",
    essence:
      "חדר בקרה, לא טבלת CRM. בנטו אסימטרי של זכוכית נוזלית שצף מעל אובערז׳ין כהה — כל אריח הוא מכשיר חי. דופק ההכנסות הוא הגיבור, והעין נשלטת על־ידי טבעת זהב שמפעמת אל היעד.",
    visualLanguage: [
      "Liquid-glass bento — אריחים אסימטריים צפים עם hairline איריסי (זהב→סחלב)",
      "היררכיית עומק: אריח-גיבור עם זוהר זהב, אריחים משניים שקטים יותר",
      "כל נתון = תכשיט: טבעות התקדמות, גרפי שמפניה, מספרים מטאליים",
      "אווירה קולנועית — light-wells, גרעין פילם עדין, vignette",
    ],
    typography: [
      { role: "כותרות (עברית)", font: "Frank Ruhl Libre · 700–900" },
      { role: "מספרים / Wordmark", font: "Cormorant · 600" },
      { role: "ממשק וגוף", font: "Heebo · 400–600" },
    ],
    palette: [
      { name: "Plum-Black", value: "#140a13" },
      { name: "Aubergine", value: "#3a1a36" },
      { name: "Champagne", value: "#d9bd84", ink: true },
      { name: "Rose Gold", value: "#e8b8a6", ink: true },
      { name: "Pearl", value: "#f6eef2", ink: true },
      { name: "Live", value: "#6fe0b0", ink: true },
    ],
    motion:
      "אריחים נכנסים ב־blur-up מדורג (stagger 60ms) עם spring רך; ריחוף מרים את האריח 4px וזוהר הזהב מתחזק. הטבעת מציירת את עצמה, הגרפים גדלים מהבסיס.",
    million:
      "בעלת עסק פותחת אותו ומרגישה שהיא שולטת בחללית. צפיפות מידע גבוהה שנשארת אלגנטית — זה מה שמפריד בין כלי-עבודה זול למוצר פרימיום שמרגיש יקר בכל פיקסל.",
  },
  {
    id: "concierge",
    index: "02",
    nameHe: "הקונסיירז׳",
    nameEn: "Glam AI Concierge",
    tagline: "עוזרת אישית שאומרת לך מה לעשות היום",
    essence:
      "לא דשבורד — שיחה. כדור AI איריסי מספר לך את היום כעיתון אישי: ארבעה ׳רגעים׳ מדורגים לפי השפעה. טיפוגרפיה עריכתית גדולה, הרבה אוויר, רגש. המוצר מדבר אלייך בגובה העיניים.",
    visualLanguage: [
      "Orb איריסי חי (conic-gradient מסתובב + pulse) כקול המותג",
      "פיד ׳רגעים׳ מדורג — מספר עריכתי ענק, כותרת סריף, פעולה אחת ברורה",
      "כרטיס מוביל עם זוהר זהב; השאר שקטים — מיקוד מוחלט",
      "שורת ׳שאלי את אלורה׳ שמוכרת את תחושת ה־AI",
    ],
    typography: [
      { role: "אמירות (עברית)", font: "Frank Ruhl Libre · 700, leading-tight" },
      { role: "דירוג / Eyebrow", font: "Cormorant · 600 · tracking רחב" },
      { role: "גוף", font: "Heebo · 400–500" },
    ],
    palette: [
      { name: "Plum-Black", value: "#140a13" },
      { name: "Orchid", value: "#b98fce", ink: true },
      { name: "Blush", value: "#e7a9c4", ink: true },
      { name: "Champagne", value: "#d9bd84", ink: true },
      { name: "Iridescent", value: "linear-gradient(120deg,#e7a9c4,#d9bd84,#b98fce,#e8b8a6)", ink: true },
      { name: "Pearl", value: "#f6eef2", ink: true },
    ],
    motion:
      "הכדור נושם ופולס ברציפות. כל ׳רגע׳ עולה ב־blur-up עם stagger; הכותרת האיריסית מבליחה צבע. בעת לחיצה, הכרטיס יכול להתקפל לפעולה שבוצעה.",
    million:
      "מרגיש כמו מוצר AI יוקרתי של 2026, לא לוח ניהול. הרגש (׳הלקוחות מתגעגעות אלייך׳) + מיקוד מוחלט = מוצר שזוכרים ומספרים עליו לחברה. זה ה־wow שגורם לאנשים לשאול ׳מי עיצב את זה?׳.",
  },
  {
    id: "cockpit",
    index: "03",
    nameHe: "הקוקפיט",
    nameEn: "Beauty Studio Cockpit",
    tagline: "יומן־תחילה, תור־תחילה, פעולה־תחילה — קולנועי",
    essence:
      "עמוד שדרה של זמן. ציר יום אנכי עם קו ׳עכשיו׳ זוהר וכרטיסי תור עתירי־פעולה. כל תור הוא תחנה על הציר; אישור, וואטסאפ ופעולות במרחק מבט. צד שמאל — תא הטייס: התור הבא, פעולות, דופק.",
    visualLanguage: [
      "Spine אנכי עם נקודות-ציר וקו ׳עכשיו׳ זוהר (rose→champagne)",
      "כרטיסי תור פעולתיים — אישור/וואטסאפ inline, סטטוס צבעוני",
      "כרטיס ׳התור הבא׳ דומיננטי עם countdown",
      "תא טייס: פעולות מהירות 2×2, טבעת הכנסות, מילוי חלונות",
    ],
    typography: [
      { role: "שמות לקוחות", font: "Frank Ruhl Libre · 700" },
      { role: "שעות / מחירים", font: "Cormorant + Heebo · tabular" },
      { role: "ממשק", font: "Heebo · 400–600" },
    ],
    palette: [
      { name: "Plum-Black", value: "#140a13" },
      { name: "Aubergine", value: "#3a1a36" },
      { name: "Rose Gold", value: "#e8b8a6", ink: true },
      { name: "Champagne", value: "#d9bd84", ink: true },
      { name: "Live", value: "#6fe0b0", ink: true },
      { name: "Hot", value: "#f06a8a", ink: true },
    ],
    motion:
      "שורות הציר נכנסות מהצד (slide-in) עם stagger; הנקודה הבאה פולסת. קו ׳עכשיו׳ זורח ונע. ריחוף מרים כרטיס וחושף את הפעולות.",
    million:
      "בעלת עסק עמוסה רואה את כל היום בשנייה ופועלת בלי לחשוב. השילוב של בהירות תפעולית מוחלטת עם זוהר קולנועי הוא מה שאפליקציות יומן רגילות לעולם לא משיגות — שימושי ויפהפה גם יחד.",
  },
];

function Swatch({ name, value }: { name: string; value: string; ink?: boolean }) {
  const isGrad = value.startsWith("linear");
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-12 w-full rounded-xl ring-1 ring-[rgba(236,217,175,0.18)]"
        style={{ background: value }}
      />
      <span className="text-[0.62rem] text-[var(--lab-pearl-mute)]">{name}</span>
      {!isGrad && <span className="lab-num text-[0.58rem] text-[var(--lab-pearl-faint)]">{value}</span>}
    </div>
  );
}

export function DossierPanel({ d }: { d: Dossier }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* visual language */}
      <div className="lab-glass lab-edge rounded-3xl p-6">
        <Eyebrow he className="mb-4 text-[var(--lab-pearl-mute)]">שפה חזותית</Eyebrow>
        <ul className="space-y-3">
          {d.visualLanguage.map((v, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-[var(--lab-pearl-soft)]">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--lab-grad-gold)" }} />
              {v}
            </li>
          ))}
        </ul>
      </div>

      {/* typography + palette */}
      <div className="lab-glass lab-edge rounded-3xl p-6">
        <Eyebrow he className="mb-4 text-[var(--lab-pearl-mute)]">טיפוגרפיה</Eyebrow>
        <div className="space-y-2.5">
          {d.typography.map((t, i) => (
            <div key={i} className="flex items-center justify-between border-b border-[rgba(236,217,175,0.1)] pb-2 last:border-0">
              <span className="text-xs text-[var(--lab-pearl-mute)]">{t.role}</span>
              <span className="lab-serif text-sm text-[var(--lab-pearl)]">{t.font}</span>
            </div>
          ))}
        </div>
        <Eyebrow he className="mb-3 mt-6 text-[var(--lab-pearl-mute)]">פלטה</Eyebrow>
        <div className="grid grid-cols-3 gap-3">
          {d.palette.map((p) => <Swatch key={p.name} {...p} />)}
        </div>
      </div>

      {/* motion + million */}
      <div className="space-y-5">
        <div className="lab-glass lab-edge rounded-3xl p-6">
          <Eyebrow he className="mb-3 text-[var(--lab-pearl-mute)]">תנועה ואינטראקציה</Eyebrow>
          <p className="text-sm leading-relaxed text-[var(--lab-pearl-soft)]">{d.motion}</p>
        </div>
        <div className="lab-glass-strong lab-edge-gold rounded-3xl p-6">
          <Eyebrow className="mb-3">WHY ₪1,000,000</Eyebrow>
          <p className="text-sm leading-relaxed text-[var(--lab-pearl)]">{d.million}</p>
        </div>
      </div>
    </div>
  );
}
