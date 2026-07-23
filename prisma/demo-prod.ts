/**
 * Allura DEMO enrichment — fills an account with rich, realistic Hebrew data
 * so every product page looks full and beautiful for a live demo.
 *
 * What it does:
 *   1. STAR business — the platform-admin owner (ADMIN_EMAIL below). Renamed to
 *      a pretty studio and filled with ~20 clients, 6 services, ~4 months of
 *      bookings across every status, a loyalty club, waitlist, expenses,
 *      reviews and a finished win-back campaign.
 *   2. SECONDARY businesses — 4 additional realistic studios (own owner users)
 *      with lighter data, so the /admin god-mode analytics, leaderboards and
 *      activity feed look alive across tenants.
 *
 * SAFETY:
 *   - Every WhatsApp auto-send (loyalty + automations) is left OFF, so running
 *     this never sends a real message to the (fake) demo phone numbers.
 *   - Idempotent: businesses are keyed by slug; on each run their scoped data
 *     is cleared and recreated. Other businesses/users are untouched.
 *   - Reads DATABASE_URL from the environment — point it at prod explicitly:
 *       DATABASE_URL="postgres://…neon…" npx tsx prisma/demo-prod.ts
 *
 * The star business is matched to the CURRENT admin owner by email so their own
 * login shows the rich dashboard. Override with ADMIN_EMAIL if needed.
 */

import {
  PrismaClient,
  type BookingStatus,
  type BookingSource,
  type BusinessCategoryKey,
  type ExpenseCategory,
  type ActivityCategory,
  type Service,
  type Client,
  type Business,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "guymuslave@gmail.com";
const DEMO_PASSWORD = "Demo123456!";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

function now(): Date {
  return new Date();
}
/** A date `offsetDays` from today at HH:MM (offset can be negative). */
function at(offsetDays: number, h: number, m: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(h, m, 0, 0);
  return d;
}
function endOf(start: Date, durationMinutes: number): Date {
  return new Date(start.getTime() + durationMinutes * MIN);
}
function randInt(a: number, b: number): number {
  return a + Math.floor(Math.random() * (b - a + 1));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
/** Recency-biased "days ago" in [minD, maxD] — more mass near minD (recent). */
function recencyBiasedDaysAgo(minD: number, maxD: number): number {
  const t = Math.pow(Math.random(), 1.6); // bias toward 0
  return Math.round(minD + t * (maxD - minD));
}
/** A completed-visit datetime `daysAgo` days back at a random open hour. */
function pastVisit(daysAgo: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(randInt(9, 16), pick([0, 15, 30, 45]), 0, 0);
  return d;
}
function normalizePhone(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("972")) d = "0" + d.slice(3);
  return d;
}

// ─── Static content pools ───────────────────────────────────────────────────

const FIRST_NAMES = [
  "נועה", "מיה", "שירה", "דנה", "רוני", "ליאור", "טל", "עדי", "יעל", "מאיה",
  "הדר", "אור", "רותם", "ספיר", "אלה", "גל", "נטע", "שני", "ניצן", "קרן",
  "מור", "יובל", "אודליה", "לינוי", "אביגיל", "תמר", "רוית", "סיון",
];
const LAST_NAMES = [
  "כהן", "לוי", "מזרחי", "פרץ", "ביטון", "אברהם", "דהן", "אזולאי", "גבאי",
  "חדד", "מלכה", "אוחיון", " שרון", "בן דוד", "נחום", "קדוש", "עמר",
];

const REVIEW_TEXTS = [
  "חוויה מפנקת ומקצועית, כבר קבעתי תור הבא! ממליצה בחום ❤️",
  "הכי נעים והכי מקצועי שיש. יוצאת מרוצה בכל פעם.",
  "יחס אישי, מקום נקי ומזמין, והתוצאה מושלמת.",
  "שירות ברמה אחרת. סוף סוף מצאתי את המקום שלי.",
  "מקצועיות בלי פשרות ואווירה מדהימה. תודה!",
  "הגעתי בהמלצה ולא מתחרטת לרגע. פשוט מהמם.",
  "תמיד מקשיבה בדיוק למה שאני רוצה. אלופה!",
];

// ─── Business + data spec ───────────────────────────────────────────────────

type ServiceSpec = {
  name: string;
  categoryKey: BusinessCategoryKey;
  description: string;
  durationMinutes: number;
  price: number;
  market: [number, number, number]; // min, avg, max
};

type BizSpec = {
  slug: string;
  name: string;
  description: string;
  city: string;
  phone: string;
  categories: BusinessCategoryKey[];
  services: ServiceSpec[];
  clientCount: number;
  /** Approx completed visits for the busiest client (scales the whole business). */
  topVisits: number;
  brandColor: string;
};

const STAR_SERVICES: ServiceSpec[] = [
  { name: "לק ג'ל", categoryKey: "nails", description: "לק ג'ל מקצועי בכל צבע, כולל הכנה ועיצוב מלא", durationMinutes: 60, price: 180, market: [160, 195, 230] },
  { name: "מניקור ופדיקור", categoryKey: "nails", description: "טיפול ידיים ורגליים מלא ומפנק", durationMinutes: 75, price: 220, market: [190, 230, 280] },
  { name: "עיצוב והרמת גבות", categoryKey: "brows", description: "עיצוב מדויק, שיזוף והרמת גבות לפי מבנה הפנים", durationMinutes: 45, price: 120, market: [110, 140, 175] },
  { name: "טיפול פנים מפנק", categoryKey: "cosmetics", description: "טיפול פנים מעמיק לניקוי, הזנה ולחות", durationMinutes: 90, price: 340, market: [300, 360, 440] },
  { name: "הרמת ריסים", categoryKey: "lashes", description: "הרמת ריסים טבעית עם תוצאה שנשארת שבועות", durationMinutes: 60, price: 200, market: [180, 210, 260] },
  { name: "הסרת שיער בשעווה", categoryKey: "cosmetics", description: "הסרת שיער עדינה ומהירה", durationMinutes: 30, price: 90, market: [95, 115, 145] }, // price < marketMin → pricing insight
];

const STAR_SPEC: BizSpec = {
  slug: "maya-beauty-studio",
  name: "מאיה — סטודיו יופי",
  description: "סטודיו בוטיק לטיפולי יופי וטיפוח באווירה אישית, חמה ומפנקת.",
  city: "תל אביב",
  phone: "050-555-7890",
  categories: ["nails", "brows", "lashes", "cosmetics"],
  services: STAR_SERVICES,
  clientCount: 20,
  topVisits: 14,
  brandColor: "#ac5c7f",
};

const SECONDARY_SPECS: BizSpec[] = [
  {
    slug: "tal-nails-studio", name: "טל ניילס סטודיו",
    description: "אמנות ציפורניים ולק ג'ל בעיצוב אישי.", city: "רמת גן", phone: "052-410-2200",
    categories: ["nails"], brandColor: "#c2708e",
    services: [
      { name: "לק ג'ל", categoryKey: "nails", description: "לק ג'ל מלא", durationMinutes: 60, price: 170, market: [150, 185, 220] },
      { name: "בנייה בג'ל", categoryKey: "nails", description: "בנייה מלאה בג'ל", durationMinutes: 90, price: 250, market: [220, 260, 320] },
      { name: "מילוי", categoryKey: "nails", description: "מילוי בנייה", durationMinutes: 60, price: 160, market: [140, 170, 210] },
    ],
    clientCount: 12, topVisits: 11,
  },
  {
    slug: "roni-lash-bar", name: "רוני לאש בר",
    description: "הרמות והארכות ריסים בגימור מושלם.", city: "הרצליה", phone: "053-820-4410",
    categories: ["lashes"], brandColor: "#92609f",
    services: [
      { name: "הרמת ריסים", categoryKey: "lashes", description: "הרמת ריסים טבעית", durationMinutes: 60, price: 210, market: [190, 220, 270] },
      { name: "הארכת ריסים קלאסי", categoryKey: "lashes", description: "הארכה בשיטה קלאסית", durationMinutes: 120, price: 350, market: [320, 370, 450] },
      { name: "מילוי ריסים", categoryKey: "lashes", description: "מילוי הארכות", durationMinutes: 75, price: 220, market: [200, 240, 300] },
    ],
    clientCount: 11, topVisits: 10,
  },
  {
    slug: "orly-cosmetics", name: "אורלי קוסמטיקס",
    description: "קליניקה לטיפולי פנים מתקדמים וטיפוח העור.", city: "פתח תקווה", phone: "054-330-9980",
    categories: ["cosmetics", "aesthetics"], brandColor: "#b06a86",
    services: [
      { name: "טיפול פנים קלאסי", categoryKey: "cosmetics", description: "ניקוי והזנת העור", durationMinutes: 75, price: 300, market: [270, 320, 400] },
      { name: "פילינג כימי", categoryKey: "aesthetics", description: "חידוש העור בפילינג", durationMinutes: 60, price: 380, market: [350, 410, 500] },
      { name: "מיצוק ולחות", categoryKey: "cosmetics", description: "טיפול לחות עמוק", durationMinutes: 60, price: 260, market: [230, 280, 350] },
    ],
    clientCount: 10, topVisits: 9,
  },
  {
    slug: "shir-spa-retreat", name: "שיר ספא",
    description: "עיסויים וטיפולי גוף מרגיעים בנווה שקט.", city: "מודיעין", phone: "058-712-6633",
    categories: ["massage", "spa"], brandColor: "#a15f7d",
    services: [
      { name: "עיסוי שוודי", categoryKey: "massage", description: "עיסוי גוף מרגיע", durationMinutes: 60, price: 280, market: [250, 300, 380] },
      { name: "עיסוי רקמות עמוק", categoryKey: "massage", description: "עיסוי טיפולי", durationMinutes: 75, price: 340, market: [310, 360, 450] },
      { name: "חבילת פינוק זוגית", categoryKey: "spa", description: "עיסוי זוגי + כיבוד", durationMinutes: 120, price: 640, market: [580, 680, 820] },
    ],
    clientCount: 9, topVisits: 8,
  },
];

// ─── Loyalty starter copy (kept OFF for auto-send) ──────────────────────────

const LOYALTY_ALMOST =
  "היי {clientName}! נשאר לך רק ביקור אחד עד המתנה שלך במאיה — סטודיו יופי 💅 נשמח לראות אותך!";
const LOYALTY_REWARD =
  "וואו {clientName}, השלמת {completedVisits} ביקורים — הגיע הזמן לפרגן לך! ההטבה שלך מחכה 🎁";

// ─── Per-business generator ─────────────────────────────────────────────────

async function clearBusinessData(businessId: string) {
  await prisma.activityLog.deleteMany({ where: { businessId } });
  await prisma.loyaltyMessage.deleteMany({ where: { businessId } });
  await prisma.loyaltyRedemption.deleteMany({ where: { businessId } });
  await prisma.loyaltyProgram.deleteMany({ where: { businessId } });
  await prisma.whatsAppCampaignRecipient.deleteMany({ where: { businessId } });
  await prisma.whatsAppCampaign.deleteMany({ where: { businessId } });
  await prisma.recommendation.deleteMany({ where: { businessId } });
  await prisma.reminder.deleteMany({ where: { businessId } });
  await prisma.waitlistEntry.deleteMany({ where: { businessId } });
  await prisma.clientReview.deleteMany({ where: { businessId } });
  await prisma.expense.deleteMany({ where: { businessId } });
  await prisma.automationMessage.deleteMany({ where: { businessId } });
  await prisma.booking.updateMany({ where: { businessId }, data: { rescheduledFromBookingId: null } });
  await prisma.booking.deleteMany({ where: { businessId } });
  await prisma.client.deleteMany({ where: { businessId } });
  await prisma.service.deleteMany({ where: { businessId } });
  await prisma.availabilityRule.deleteMany({ where: { businessId } });
  await prisma.availabilityException.deleteMany({ where: { businessId } });
}

async function seedBusinessData(
  business: Business,
  userId: string,
  spec: BizSpec,
  isStar: boolean,
) {
  await clearBusinessData(business.id);

  // Categories
  const cats = await prisma.businessCategory.findMany({
    where: { key: { in: spec.categories } },
    select: { id: true },
  });
  for (const c of cats) {
    await prisma.businessCategoryOnBusiness.upsert({
      where: { businessId_categoryId: { businessId: business.id, categoryId: c.id } },
      update: {},
      create: { businessId: business.id, categoryId: c.id },
    });
  }

  // Services
  const services: Service[] = [];
  for (const s of spec.services) {
    services.push(
      await prisma.service.create({
        data: {
          businessId: business.id,
          categoryKey: s.categoryKey,
          name: s.name,
          description: s.description,
          durationMinutes: s.durationMinutes,
          price: s.price,
          marketMinPrice: s.market[0],
          marketAveragePrice: s.market[1],
          marketMaxPrice: s.market[2],
        },
      }),
    );
  }

  // Availability: Sun–Thu 09:00–18:00, Fri 09:00–13:30
  await prisma.availabilityRule.createMany({
    data: [
      ...[0, 1, 2, 3, 4].map((wd) => ({
        businessId: business.id, weekday: wd, startMinutes: 540, endMinutes: 1080, isActive: true,
      })),
      { businessId: business.id, weekday: 5, startMinutes: 540, endMinutes: 810, isActive: true },
    ],
  });

  // Clients — assign a profile tag + target completed-visit count
  type Tag = "vip" | "close" | "regular" | "lapsed" | "noshow" | "cancel" | "new";
  const n = spec.clientCount;
  const clientTags: Tag[] = [];
  clientTags.push("vip", "vip");                 // eligible for loyalty reward
  clientTags.push("close", "close");             // one visit from reward
  clientTags.push("lapsed", "lapsed", "lapsed"); // win-back / retention
  clientTags.push("noshow");                     // no-show attention
  clientTags.push("cancel");                     // repeat cancellations
  clientTags.push("new");                        // brand-new client
  while (clientTags.length < n) clientTags.push("regular");

  const usedNames = new Set<string>();
  function uniqueName(): string {
    for (let i = 0; i < 50; i++) {
      const nm = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`.replace(/\s+/g, " ").trim();
      if (!usedNames.has(nm)) { usedNames.add(nm); return nm; }
    }
    return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)} ${usedNames.size}`;
  }

  const bizPhonePrefix = `05${randInt(0, 8)}`;
  const clients: { c: Client; tag: Tag; visits: number }[] = [];
  for (let i = 0; i < n; i++) {
    const tag = clientTags[i];
    const visits =
      tag === "vip" ? randInt(spec.topVisits - 2, spec.topVisits) :
      tag === "close" ? randInt(8, 9) : // 1–2 visits from the next reward (visitsRequired=10)
      tag === "lapsed" ? randInt(2, 5) :
      tag === "new" ? 0 :
      tag === "noshow" ? randInt(1, 3) :
      tag === "cancel" ? randInt(1, 4) :
      randInt(1, Math.max(2, spec.topVisits - 4));
    const phone = `${bizPhonePrefix}-${String(1000000 + i * 137 + randInt(0, 90)).slice(-7)}`;
    const notesPool = [
      tag === "vip" ? "לקוחה ותיקה ואהובה, מגיעה בקביעות" :
      tag === "lapsed" ? "לא הגיעה מזמן — כדאי ליצור קשר" :
      tag === "cancel" ? "ביטלה מספר תורים — לשים לב" :
      tag === "new" ? "הגיעה דרך לינק ההזמנה הציבורי" : "",
      "מעדיפה צבעים עדינים", "רגישות קלה בעור", "אוהבת שקט בזמן הטיפול", "",
    ];
    const c = await prisma.client.create({
      data: {
        businessId: business.id,
        fullName: uniqueName(),
        phone,
        normalizedPhone: normalizePhone(phone),
        email: Math.random() < 0.4 ? `client${i}.${spec.slug}@example.com` : null,
        notes: pick(notesPool) || null,
      },
    });
    clients.push({ c, tag, visits });
  }

  // Bookings
  type BDef = {
    client: Client; service: Service; start: Date; status: BookingStatus;
    source: BookingSource; notes?: string; cancellationReason?: string;
    cancelledAt?: Date; completedAt?: Date; noShowAt?: Date;
  };
  const defs: BDef[] = [];
  const counters = new Map<string, { total: number; spent: number; last: Date | null; noShow: number; cancel: number }>();
  const bump = (id: string, spent: number, when: Date | null) => {
    const cur = counters.get(id) || { total: 0, spent: 0, last: null, noShow: 0, cancel: 0 };
    cur.total += 1; cur.spent += spent;
    if (when && (!cur.last || when > cur.last)) cur.last = when;
    counters.set(id, cur);
  };

  // Completed history per client → drives revenue, forecast, loyalty counts
  for (const { c, tag, visits } of clients) {
    for (let v = 0; v < visits; v++) {
      const svc = pick(services);
      let daysAgo: number;
      if (tag === "lapsed") daysAgo = randInt(38, 95);
      else if (v === 0 && (tag === "vip" || tag === "regular" || tag === "close"))
        daysAgo = randInt(2, 12); // a recent visit → reputation page
      else daysAgo = recencyBiasedDaysAgo(3, 118);
      const start = pastVisit(daysAgo);
      defs.push({
        client: c, service: svc, start, status: "completed", source: pick(["manual", "manual", "public"]),
        completedAt: endOf(start, svc.durationMinutes),
      });
      bump(c.id, Number(svc.price), start);
    }
  }

  // Today's schedule (star gets a fuller day) — distinct time slots
  const todayHours = isStar ? [9, 10.5, 12, 14, 15.5, 17] : [10, 12, 15];
  const activeClients = clients.filter((c) => c.tag !== "lapsed");
  todayHours.forEach((hh, idx) => {
    const cl = activeClients[(idx * 3 + 1) % activeClients.length];
    const svc = pick(services);
    const h = Math.floor(hh), m = (hh % 1) * 60;
    const status: BookingStatus = idx === todayHours.length - 1 ? "pending" : "approved";
    defs.push({ client: cl.c, service: svc, start: at(0, h, m), status, source: status === "pending" ? "public" : "manual" });
  });

  // Upcoming (next 12 days) — distinct slots, some public pending
  for (let i = 0; i < (isStar ? 9 : 4); i++) {
    const cl = pick(activeClients);
    const svc = pick(services);
    const day = randInt(1, 12);
    const start = at(day, pick([9, 10, 11, 13, 14, 16]), pick([0, 30]));
    const status: BookingStatus = Math.random() < 0.3 ? "pending" : "approved";
    defs.push({
      client: cl.c, service: svc, start, status,
      source: status === "pending" ? "public" : "manual",
      notes: Math.random() < 0.2 ? "להכין מוצרים מראש" : undefined,
    });
  }

  // No-shows
  for (const { c } of clients.filter((x) => x.tag === "noshow")) {
    const svc = pick(services);
    const start = pastVisit(randInt(8, 25));
    defs.push({ client: c, service: svc, start, status: "no_show", source: "manual", noShowAt: endOf(start, 15) });
    const cur = counters.get(c.id) || { total: 0, spent: 0, last: null, noShow: 0, cancel: 0 };
    cur.noShow += 1; counters.set(c.id, cur);
  }

  // Cancellations (cancel-tagged clients get 2 → repeat-cancellation rule)
  for (const { c, tag } of clients) {
    const k = tag === "cancel" ? 2 : Math.random() < 0.12 ? 1 : 0;
    for (let i = 0; i < k; i++) {
      const svc = pick(services);
      const start = pastVisit(randInt(5, 40));
      defs.push({
        client: c, service: svc, start, status: "cancelled", source: "manual",
        cancellationReason: pick(["הלקוחה ביטלה עקב עיסוקים אישיים", "שינוי בלוח הזמנים", "הרגישה לא טוב"]),
        cancelledAt: new Date(start.getTime() - randInt(1, 30) * 3600_000),
      });
      const cur = counters.get(c.id) || { total: 0, spent: 0, last: null, noShow: 0, cancel: 0 };
      cur.cancel += 1; counters.set(c.id, cur);
    }
  }

  // Insert bookings — enforce a unique startTime per business (DB constraint),
  // nudging colliding slots forward in 5-minute steps.
  const usedStarts = new Set<number>();
  for (const b of defs) {
    let ts = b.start.getTime();
    while (usedStarts.has(ts)) ts += 5 * MIN;
    usedStarts.add(ts);
    const start = new Date(ts);
    await prisma.booking.create({
      data: {
        businessId: business.id, clientId: b.client.id, serviceId: b.service.id,
        startTime: start, endTime: endOf(start, b.service.durationMinutes),
        status: b.status, source: b.source,
        priceSnapshot: b.service.price, durationMinutesSnapshot: b.service.durationMinutes,
        notes: b.notes ?? null, cancellationReason: b.cancellationReason ?? null,
        cancelledAt: b.cancelledAt ?? null, completedAt: b.completedAt ?? null, noShowAt: b.noShowAt ?? null,
      },
    });
  }

  // Client denormalized counters
  for (const { c } of clients) {
    const cur = counters.get(c.id) || { total: 0, spent: 0, last: null, noShow: 0, cancel: 0 };
    await prisma.client.update({
      where: { id: c.id },
      data: {
        totalBookings: cur.total, totalSpent: cur.spent, lastVisitAt: cur.last,
        noShowCount: cur.noShow, cancellationCount: cur.cancel,
      },
    });
  }

  // Loyalty program (auto-send OFF for safety) + redemptions for VIPs
  const visitsRequired = 10;
  await prisma.loyaltyProgram.create({
    data: {
      businessId: business.id, isActive: true, visitsRequired,
      rewardDescription: isStar ? "טיפול פנים מפנק מתנה" : "טיפול מתנה על חשבון הבית",
      autoSendEnabled: false, // never auto-send to demo numbers
      almostThereMessage: LOYALTY_ALMOST, rewardMessage: LOYALTY_REWARD,
    },
  });
  for (const { c, visits } of clients) {
    const earned = Math.floor(visits / visitsRequired);
    // Always leave the most-recently earned reward unredeemed, so every client
    // with ≥ visitsRequired completed visits reliably shows up as "eligible".
    const toRedeem = Math.max(0, earned - 1);
    for (let r = 0; r < toRedeem; r++) {
      await prisma.loyaltyRedemption.create({
        data: { businessId: business.id, clientId: c.id, visitsAtRedemption: (r + 1) * visitsRequired,
          redeemedAt: pastVisit(randInt(10, 80)) },
      });
    }
  }

  // Waitlist (active)
  const waitCount = isStar ? 4 : 2;
  for (let i = 0; i < waitCount; i++) {
    const cl = pick(activeClients);
    await prisma.waitlistEntry.create({
      data: {
        businessId: business.id, clientId: cl.c.id, serviceId: pick(services).id, status: "active",
        preferredFrom: at(randInt(1, 3), 9, 0), preferredTo: at(randInt(4, 9), 18, 0),
        notes: pick(["גמישה בשעות הבוקר", "מעדיפה אחר הצהריים", "כל תור פנוי מתאים", ""]) || null,
      },
    });
  }

  // Expenses (last 4 months) → finance profit
  const expDefs: { amount: number; description: string; category: ExpenseCategory; monthsAgo: number }[] = [
    { amount: 3200, description: "שכר דירה לחודש", category: "rent", monthsAgo: 0 },
    { amount: 3200, description: "שכר דירה לחודש", category: "rent", monthsAgo: 1 },
    { amount: 3200, description: "שכר דירה לחודש", category: "rent", monthsAgo: 2 },
    { amount: 1250, description: "חומרים ומלאי", category: "materials", monthsAgo: 0 },
    { amount: 980, description: "חומרים ומלאי", category: "materials", monthsAgo: 1 },
    { amount: 1400, description: "פרסום ממומן באינסטגרם", category: "marketing", monthsAgo: 0 },
    { amount: 650, description: "מנוי לתוכנת ניהול", category: "software", monthsAgo: 1 },
    { amount: 2100, description: "ציוד חדש לטיפולים", category: "equipment", monthsAgo: 2 },
  ];
  for (const e of expDefs) {
    const d = new Date(); d.setMonth(d.getMonth() - e.monthsAgo); d.setDate(randInt(2, 26));
    await prisma.expense.create({
      data: { businessId: business.id, amount: e.amount, description: e.description, category: e.category, date: d },
    });
  }

  // Reviews (approved) → reputation + public page
  const reviewCount = isStar ? 6 : 3;
  const shuffledReviews = [...REVIEW_TEXTS].sort(() => Math.random() - 0.5);
  for (let i = 0; i < reviewCount; i++) {
    await prisma.clientReview.create({
      data: {
        businessId: business.id, clientName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES).charAt(0)}.`,
        reviewText: shuffledReviews[i % shuffledReviews.length], rating: pick([5, 5, 5, 4]), isApproved: true,
        createdAt: pastVisit(randInt(3, 70)),
      },
    });
  }

  // A finished win-back campaign (historical → no live send) for the campaigns page
  if (isStar) {
    const lapsed = clients.filter((c) => c.tag === "lapsed" || c.tag === "regular").slice(0, 6);
    const when = pastVisit(9);
    const campaign = await prisma.whatsAppCampaign.create({
      data: {
        businessId: business.id, createdByUserId: userId,
        templateName: "allura_win_back_he", templateLanguage: "he", templateCategory: "MARKETING",
        audienceSummary: "לקוחות שלא הגיעו מעל 30 יום", status: "completed",
        totalSelected: lapsed.length, totalEligible: lapsed.length,
        createdAt: when, startedAt: when, completedAt: when,
      },
    });
    for (const { c } of lapsed) {
      await prisma.whatsAppCampaignRecipient.create({
        data: {
          campaignId: campaign.id, businessId: business.id, clientId: c.id,
          normalizedPhone: c.normalizedPhone, status: "sent", sentAt: when, acceptedAt: when,
        },
      });
    }
  }

  // Activity log (recent, varied) → /admin telemetry feed
  const acts: { category: ActivityCategory; action: string; summary: string; daysAgo: number }[] = [
    { category: "booking", action: "booking.create", summary: `תור חדש נקבע ב${spec.name}`, daysAgo: 0 },
    { category: "booking", action: "booking.complete", summary: "תור הושלם וסומן כבוצע", daysAgo: 0 },
    { category: "client", action: "client.create", summary: "לקוחה חדשה נוספה למערכת", daysAgo: 1 },
    { category: "finance", action: "expense.create", summary: "נרשמה הוצאה חדשה", daysAgo: 1 },
    { category: "loyalty", action: "loyalty.redeem", summary: "הטבת נאמנות מומשה ללקוחה", daysAgo: 2 },
    { category: "booking", action: "booking.create", summary: "התקבלה בקשת תור מהעמוד הציבורי", daysAgo: 2 },
    { category: "service", action: "service.update", summary: "מחיר שירות עודכן", daysAgo: 3 },
  ];
  for (const a of acts.slice(0, isStar ? acts.length : 4)) {
    const d = new Date(now().getTime() - a.daysAgo * DAY - randInt(0, 20) * 3600_000);
    await prisma.activityLog.create({
      data: {
        businessId: business.id, userId, actorType: "owner",
        category: a.category, action: a.action, summary: a.summary, createdAt: d,
      },
    });
  }

  // Mark the owner recently active
  await prisma.user.update({
    where: { id: userId },
    data: { lastSeenAt: new Date(now().getTime() - randInt(0, 6) * 3600_000) },
  });

  const totalBookings = defs.length;
  return { services: services.length, clients: clients.length, bookings: totalBookings };
}

// ─── Business resolution ────────────────────────────────────────────────────

async function ensureOwnerAndBusiness(
  email: string, ownerName: string, spec: BizSpec,
): Promise<{ business: Business; userId: string }> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { plan: "platinum" },
    create: { email, name: ownerName, passwordHash, plan: "platinum", planActivatedAt: new Date() },
  });

  const bizFields = {
    name: spec.name, description: spec.description, city: spec.city, area: spec.city,
    phone: spec.phone, brandColor: spec.brandColor,
    introMessage: "נעים להכיר! קבעו תור בקלות ותנו לעצמכם רגע של פינוק.",
    showServices: true, showPrices: true, showHours: true, showReviews: true,
    showGallery: false, showPhone: true, showAddress: true, showCancellationPolicy: true,
  };
  const business = await prisma.business.upsert({
    where: { slug: spec.slug },
    update: bizFields,
    create: { ...bizFields, slug: spec.slug },
  });
  await prisma.businessUser.upsert({
    where: { userId_businessId: { userId: user.id, businessId: business.id } },
    update: {},
    create: { userId: user.id, businessId: business.id, role: "owner" },
  });
  return { business, userId: user.id };
}

async function resolveStarBusiness(): Promise<{ business: Business; userId: string }> {
  const admin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    include: { memberships: { include: { business: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!admin) {
    console.log(`⚠  admin user ${ADMIN_EMAIL} not found — creating it as the star owner.`);
    return ensureOwnerAndBusiness(ADMIN_EMAIL, "מאיה", STAR_SPEC);
  }
  // Keep admin flag + plan so they can reach /admin and the paywall is bypassed.
  await prisma.user.update({
    where: { id: admin.id },
    data: { isAdmin: true, plan: "platinum", planActivatedAt: admin.planActivatedAt ?? new Date() },
  });

  const existing = admin.memberships.find((m) => m.role === "owner") ?? admin.memberships[0];
  // Give the star a pretty public slug unless it's already taken by another business.
  const slugTaken = await prisma.business.findFirst({
    where: { slug: STAR_SPEC.slug, ...(existing ? { NOT: { id: existing.businessId } } : {}) },
    select: { id: true },
  });
  const bizFields = {
    name: STAR_SPEC.name, description: STAR_SPEC.description, city: STAR_SPEC.city, area: STAR_SPEC.city,
    phone: STAR_SPEC.phone, brandColor: STAR_SPEC.brandColor,
    introMessage: "נעים להכיר! קבעו תור בקלות ותנו לעצמכם רגע של פינוק.",
    showServices: true, showPrices: true, showHours: true, showReviews: true,
    showGallery: false, showPhone: true, showAddress: true, showCancellationPolicy: true,
  };
  if (existing) {
    const business = await prisma.business.update({
      where: { id: existing.businessId },
      data: slugTaken ? bizFields : { ...bizFields, slug: STAR_SPEC.slug },
    });
    return { business, userId: admin.id };
  }
  // Admin has no business yet — create the star business under them.
  const business = await prisma.business.create({ data: { ...bizFields, slug: STAR_SPEC.slug } });
  await prisma.businessUser.create({ data: { userId: admin.id, businessId: business.id, role: "owner" } });
  return { business, userId: admin.id };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const dbHost = (process.env.DATABASE_URL || "").replace(/:[^:@]*@/, ":****@").replace(/\?.*$/, "");
  console.log("🌱  Allura DEMO enrichment");
  console.log(`    DB: ${dbHost || "(DATABASE_URL not set!)"}`);
  console.log(`    Admin/star owner: ${ADMIN_EMAIL}\n`);

  // 1. Star business (the admin's own)
  const star = await resolveStarBusiness();
  const starStats = await seedBusinessData(star.business, star.userId, STAR_SPEC, true);
  console.log(`✔  STAR  ${star.business.name}  /${star.business.slug}`);
  console.log(`        services:${starStats.services} clients:${starStats.clients} bookings:${starStats.bookings}\n`);

  // 2. Secondary businesses (for /admin analytics)
  for (const spec of SECONDARY_SPECS) {
    const owner = await ensureOwnerAndBusiness(
      `owner.${spec.slug}@allura-demo.local`, spec.name.split(" ")[0], spec,
    );
    const stats = await seedBusinessData(owner.business, owner.userId, spec, false);
    console.log(`✔  ${spec.name}  /${spec.slug}  services:${stats.services} clients:${stats.clients} bookings:${stats.bookings}`);
  }

  console.log(`
✅  Demo enrichment complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Your login:   ${ADMIN_EMAIL}
  Owner view:   /dashboard  (business: ${STAR_SPEC.name})
  Public page:  /b/${STAR_SPEC.slug}
  Admin panel:  /admin  (now populated across ${SECONDARY_SPECS.length + 1} businesses)
  Auto WhatsApp sends left OFF — no messages go to demo numbers.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
