/*
 * Mock data for the design lab ONLY.
 * No real business logic, no DB, no server actions. Purely to make the
 * luxury prototype feel alive. All copy is Hebrew, RTL-first.
 */

export const owner = { name: "מאיה", business: "Studio Allura", initials: "מ" };

export type Appt = {
  time: string;
  client: string;
  service: string;
  price: number;
  status: "confirmed" | "pending" | "deposit" | "vip";
  duration: string;
  initials: string;
  tone: "blush" | "gold" | "orchid" | "rose";
};

export const appointments: Appt[] = [
  { time: "09:30", client: "נועה ברק", service: "לק ג'ל + עיצוב", price: 220, status: "confirmed", duration: "60 ד׳", initials: "נ", tone: "blush" },
  { time: "11:00", client: "שירה לוי", service: "בניית ציפורניים", price: 380, status: "vip", duration: "90 ד׳", initials: "ש", tone: "gold" },
  { time: "12:45", client: "דנה כהן", service: "מילוי + שילק", price: 260, status: "deposit", duration: "75 ד׳", initials: "ד", tone: "rose" },
  { time: "14:30", client: "יעל אבני", service: "פדיקור רפואי", price: 190, status: "pending", duration: "45 ד׳", initials: "י", tone: "orchid" },
  { time: "16:15", client: "תמר רז", service: "לק ג'ל קלאסי", price: 160, status: "confirmed", duration: "50 ד׳", initials: "ת", tone: "blush" },
  { time: "18:00", client: "אורין שמש", service: "עיצוב גבות + שעווה", price: 140, status: "confirmed", duration: "40 ד׳", initials: "א", tone: "rose" },
];

export const nextAppt = appointments[0];

export type Opportunity = {
  title: string;
  detail: string;
  meta: string;
  kind: "rebook" | "winback" | "deposit" | "review";
  value?: number;
};

export const opportunities: Opportunity[] = [
  { title: "8 לקוחות לא חזרו 45 יום", detail: "פוטנציאל החזרה גבוה — שלחי הזמנה חמה", meta: "≈ ₪1,840 פוטנציאל", kind: "winback", value: 1840 },
  { title: "5 תורים ללא מקדמה", detail: "סגרי מקדמה כדי להפחית ביטולים", meta: "סיכון ביטול", kind: "deposit" },
  { title: "12 לקוחות מרוצות", detail: "הזמן מושלם לבקש ביקורת", meta: "דירוג ממוצע 4.9", kind: "review" },
  { title: "3 לקוחות לחידוש קבוע", detail: "מתאימות למנוי טיפול חודשי", meta: "הכנסה חוזרת", kind: "rebook" },
];

export const revenue = {
  today: 1230,
  todayLabel: "היום",
  month: 28640,
  monthTarget: 32000,
  trend: 14, // % vs last month
  weekBars: [42, 58, 71, 49, 88, 96, 63], // relative heights
  weekDays: ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"],
  paid: 9,
  upcoming: 6,
};

export const automation = {
  connected: true,
  number: "972-50-•••-4827",
  sentToday: 23,
  reminders: 6,
  reviews: 4,
  queue: 3,
  flows: [
    { name: "תזכורת תור", state: "פעיל", on: true },
    { name: "בקשת ביקורת", state: "פעיל", on: true },
    { name: "החזרת לקוחות", state: "פעיל", on: true },
    { name: "מילוי חלון פנוי", state: "מושהה", on: false },
  ],
};

export const waitlist = [
  { client: "רוני מור", service: "בניית ציפורניים", when: "גמישה", hot: true },
  { client: "ליאת גל", service: "לק ג'ל", when: "השבוע", hot: false },
  { client: "הילה דרור", service: "מילוי", when: "מחר בבוקר", hot: true },
];

export const emptySlots = [
  { day: "מחר", time: "12:00", gap: "75 ד׳ פנויות" },
  { day: "מחר", time: "15:30", gap: "60 ד׳ פנויות" },
  { day: "חמישי", time: "10:00", gap: "90 ד׳ פנויות" },
];

export const quickActions = [
  { label: "תור חדש", icon: "plus" },
  { label: "לקוחה חדשה", icon: "userPlus" },
  { label: "שליחת הודעה", icon: "message" },
  { label: "מילוי חלון", icon: "sparkle" },
];

// Concierge "moments" — the AI narrates the day as a priority feed
export type Moment = {
  rank: string;
  headline: string;
  body: string;
  action: string;
  tone: "blush" | "gold" | "orchid" | "live";
  stat?: string;
};

export const moments: Moment[] = [
  {
    rank: "01",
    headline: "שירה מגיעה ב־11:00 — לקוחת VIP",
    body: "ביקור שלישי החודש. הציעי לה את ערכת הטיפוח החדשה — סבירות גבוהה לרכישה.",
    action: "הכיני הצעה אישית",
    tone: "gold",
    stat: "₪380 · ביקור #14",
  },
  {
    rank: "02",
    headline: "8 לקוחות מתגעגעות אלייך",
    body: "לא חזרו כבר 45 יום. הודעה חמה אחת יכולה להחזיר כ־₪1,840 החודש.",
    action: "שלחי הזמנה לחזרה",
    tone: "blush",
    stat: "≈ ₪1,840 פוטנציאל",
  },
  {
    rank: "03",
    headline: "מחר ב־12:00 נפתח חלון פנוי",
    body: "רוני והילה ברשימת ההמתנה ומתאימות בדיוק. הצעה מהירה תמלא אותו עוד היום.",
    action: "הציעי לרשימת ההמתנה",
    tone: "orchid",
    stat: "75 ד׳ · 2 מועמדות",
  },
  {
    rank: "04",
    headline: "5 תורים עדיין בלי מקדמה",
    body: "סגירת מקדמה מפחיתה ביטולים ב־60%. אפשר לשלוח בקשה לכולן בלחיצה.",
    action: "בקשי מקדמות",
    tone: "live",
    stat: "סיכון ביטול גבוה",
  },
];
