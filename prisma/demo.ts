/**
 * Allura demo seed — LOCAL DEVELOPMENT ONLY
 *
 * Creates a complete demo environment for "הסטודיו של יעל":
 *   - Demo business owner account  (demo@allura.local / Demo123456!)
 *   - Business with categories, services, and weekly availability
 *   - 6 realistic Hebrew clients
 *   - 12 bookings covering every key status and guidance-rule trigger
 *   - Client denormalized counters
 *
 * SAFE TO RE-RUN — data is scoped to slug "yael-studio".
 * On each run the business-specific data (services, clients, bookings …)
 * is cleared and recreated.  Other businesses/users are NOT touched.
 *
 * Usage:
 *   npm run db:demo
 *
 * Full reset + re-seed (drops the whole DB first):
 *   npm run db:reset   ← prompts for confirmation
 *   npm run db:demo
 */

import {
  PrismaClient,
  type BookingStatus,
  type BookingSource,
  type Service,
  type Client,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── Demo constants ───────────────────────────────────────────────────────────

const DEMO_EMAIL = "demo@allura.local";
const DEMO_PASSWORD = "Demo123456!";
const DEMO_SLUG = "yael-studio";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a Date offset by `offsetDays` days from today, at the given HH:MM. */
function at(offsetDays: number, h: number, m: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Adds `durationMinutes` to a start time. */
function endOf(start: Date, durationMinutes: number): Date {
  return new Date(start.getTime() + durationMinutes * 60_000);
}

/** Strips non-digit characters; converts +972/972 prefix to Israeli 0-prefix. */
function normalizePhone(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("972")) d = "0" + d.slice(3);
  return d;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Allura demo seed — LOCAL DEV ONLY");
  console.log(`    Slug: ${DEMO_SLUG}\n`);

  // ── 1. Demo user ─────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: "יעל לוי", passwordHash },
    create: { email: DEMO_EMAIL, name: "יעל לוי", passwordHash },
  });
  console.log(`✔  User       ${user.email}`);

  // ── 2. Business ───────────────────────────────────────────────────────────
  const bizFields = {
    name: "הסטודיו של יעל",
    phone: "050-555-7890",
    description: "סטודיו לטיפולי יופי וטיפוח באווירה אישית ונעימה.",
    city: "פתח תקווה",
    area: "פתח תקווה",
    addressNote: "קומה 2, כניסה מהחניה האחורית",
  };

  const business = await prisma.business.upsert({
    where: { slug: DEMO_SLUG },
    update: bizFields,
    create: {
      ...bizFields,
      slug: DEMO_SLUG,
      cancellationPolicy: {
        create: {
          policyText:
            "ביטול עד 24 שעות לפני התור — ללא עלות. ביטול מאוחר יותר יחויב ב-50% מעלות השירות.",
          minNoticeHours: 24,
        },
      },
    },
  });
  // Ensure policy exists on upsert path too
  await prisma.cancellationPolicy.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      policyText:
        "ביטול עד 24 שעות לפני התור — ללא עלות. ביטול מאוחר יותר יחויב ב-50% מעלות השירות.",
      minNoticeHours: 24,
    },
  });
  console.log(`✔  Business   ${business.name}  /${business.slug}`);

  // ── 3. Owner membership ──────────────────────────────────────────────────
  await prisma.businessUser.upsert({
    where: { userId_businessId: { userId: user.id, businessId: business.id } },
    update: {},
    create: { userId: user.id, businessId: business.id, role: "owner" },
  });
  console.log(`✔  Membership owner linked`);

  // ── 4. Categories ────────────────────────────────────────────────────────
  const catKeys = ["nails", "brows", "cosmetics"] as const;
  const cats = await prisma.businessCategory.findMany({
    where: { key: { in: [...catKeys] } },
    select: { id: true },
  });
  for (const cat of cats) {
    await prisma.businessCategoryOnBusiness.upsert({
      where: {
        businessId_categoryId: {
          businessId: business.id,
          categoryId: cat.id,
        },
      },
      update: {},
      create: { businessId: business.id, categoryId: cat.id },
    });
  }
  console.log(`✔  Categories ${catKeys.join(", ")}`);

  // ── 5. Clear prior demo data (scoped to this business) ──────────────────
  await prisma.recommendation.deleteMany({ where: { businessId: business.id } });
  await prisma.reminder.deleteMany({ where: { businessId: business.id } });
  await prisma.waitlistEntry.deleteMany({ where: { businessId: business.id } });
  // Null out self-referential FK before deleting bookings
  await prisma.booking.updateMany({
    where: { businessId: business.id },
    data: { rescheduledFromBookingId: null },
  });
  await prisma.booking.deleteMany({ where: { businessId: business.id } });
  await prisma.client.deleteMany({ where: { businessId: business.id } });
  await prisma.service.deleteMany({ where: { businessId: business.id } });
  await prisma.availabilityRule.deleteMany({ where: { businessId: business.id } });
  await prisma.availabilityException.deleteMany({ where: { businessId: business.id } });
  console.log(`✔  Cleared prior data for this business`);

  // ── 6. Services ──────────────────────────────────────────────────────────
  // עיצוב גבות has price (90) below marketMinPrice (95) → triggers pricing
  // concern rule K on the dashboard guidance card.
  const [svcGel, svcBrows, svcFacial, svcRemove] = await Promise.all([
    prisma.service.create({
      data: {
        businessId: business.id,
        categoryKey: "nails",
        name: "לק ג'ל",
        description: "לק ג'ל מקצועי בכל צבע, כולל הכנה ועיצוב מלא",
        durationMinutes: 60,
        price: 180,
        marketMinPrice: 160,
        marketAveragePrice: 195,
        marketMaxPrice: 230,
      },
    }),
    prisma.service.create({
      data: {
        businessId: business.id,
        categoryKey: "brows",
        name: "עיצוב גבות",
        description: "עיצוב מקצועי של הגבות לפי מבנה הפנים",
        durationMinutes: 30,
        price: 90,
        marketMinPrice: 95,   // intentionally above price → pricing concern
        marketAveragePrice: 115,
        marketMaxPrice: 145,
      },
    }),
    prisma.service.create({
      data: {
        businessId: business.id,
        categoryKey: "cosmetics",
        name: "טיפול פנים",
        description: "טיפול פנים מעמיק לניקוי, הזנה ולחות",
        durationMinutes: 90,
        price: 320,
        marketMinPrice: 280,
        marketAveragePrice: 350,
        marketMaxPrice: 430,
      },
    }),
    prisma.service.create({
      data: {
        businessId: business.id,
        categoryKey: "nails",
        name: "הסרת לק ג'ל",
        description: "הסרה עדינה ומקצועית של לק ג'ל",
        durationMinutes: 30,
        price: 60,
        marketMinPrice: 50,
        marketAveragePrice: 65,
        marketMaxPrice: 85,
      },
    }),
  ]);
  console.log(`✔  Services   4`);

  // ── 7. Availability rules ────────────────────────────────────────────────
  // weekday: 0 = Sunday … 6 = Saturday (JS getDay / Israeli week order)
  await prisma.availabilityRule.createMany({
    data: [
      ...[0, 1, 2, 3, 4].map((wd) => ({
        businessId: business.id,
        weekday: wd,
        startMinutes: 540,  // 09:00
        endMinutes: 1020,   // 17:00
        isActive: true,
      })),
      {
        businessId: business.id,
        weekday: 5,          // Friday
        startMinutes: 540,   // 09:00
        endMinutes: 780,     // 13:00
        isActive: true,
      },
      // Saturday (6): no rule = closed
    ],
  });
  console.log(`✔  Availability  א-ה 09:00-17:00  ו 09:00-13:00`);

  // ── 8. Clients ───────────────────────────────────────────────────────────
  const mk = (fullName: string, phone: string, notes?: string) =>
    prisma.client.create({
      data: {
        businessId: business.id,
        fullName,
        phone,
        normalizedPhone: normalizePhone(phone),
        notes: notes ?? null,
      },
    });

  const [noa, mia, shira, dana, roni, lior] = await Promise.all([
    mk("נועה כהן",   "050-111-1111", "מעדיפה צבעים עדינים, רגישות קלה בציפורניים"),
    mk("מיה לוי",    "050-222-2222"),
    mk("שירה אברהם", "050-333-3333", "לקוחה ותיקה, מגיעה כמעט כל חודש"),
    mk("דנה ביטון",  "050-444-4444", "ביטלה פעמיים — לשים לב"),
    mk("רוני מזרחי", "050-555-5555"),
    mk("ליאור פרץ",  "050-666-6666", "הגיעה דרך לינק ההזמנה הציבורי"),
  ]);
  console.log(`✔  Clients    6`);

  // ── 9. Bookings ──────────────────────────────────────────────────────────
  //
  // Guidance rules triggered by this data set:
  //   D  today bookings      → Noa (10:00) + Dana (14:00)
  //   E  pending bookings    → Dana today + Lior future public
  //   F  lost clients        → Mia (45d) + Roni (40d) — no upcoming booking
  //   G  no-show clients     → Dana (15d ago no_show)
  //   I  empty slots         → availability rules with free windows
  //   J  recent completed    → Shira (3d) + Noa (5d) — for reputation page
  //   K  pricing concern     → עיצוב גבות price < marketMinPrice

  type BookingDef = {
    client: Client;
    service: Service;
    start: Date;
    status: BookingStatus;
    source: BookingSource;
    notes?: string;
    cancellationReason?: string;
    cancelledAt?: Date;
    completedAt?: Date;
    noShowAt?: Date;
  };

  const defs: BookingDef[] = [
    // ── Today ──────────────────────────────────────────────────────────────
    // Noa · לק ג'ל · 10:00 approved                             (rules D)
    {
      client: noa, service: svcGel,
      start: at(0, 10, 0),
      status: "approved", source: "manual",
    },
    // Dana · עיצוב גבות · 14:00 pending manual                  (rules D + E)
    {
      client: dana, service: svcBrows,
      start: at(0, 14, 0),
      status: "pending", source: "manual",
    },

    // ── Upcoming ───────────────────────────────────────────────────────────
    // Shira · טיפול פנים · tomorrow 11:00 approved
    {
      client: shira, service: svcFacial,
      start: at(1, 11, 0),
      status: "approved", source: "manual",
      notes: "להכין מוצרים לפני הטיפול",
    },
    // Lior · לק ג'ל · +3 days public pending   (rule E)
    {
      client: lior, service: svcGel,
      start: at(3, 15, 0),
      status: "pending", source: "public",
    },
    // Dana · לק ג'ל · +7 days approved
    {
      client: dana, service: svcGel,
      start: at(7, 9, 30),
      status: "approved", source: "manual",
    },

    // ── Recent completed — reputation page (rule J, within 14 days) ───────
    // Shira · עיצוב גבות · 3 days ago
    {
      client: shira, service: svcBrows,
      start: at(-3, 11, 0),
      status: "completed", source: "manual",
      completedAt: at(-3, 11, 30),
    },
    // Noa · טיפול פנים · 5 days ago
    {
      client: noa, service: svcFacial,
      start: at(-5, 10, 0),
      status: "completed", source: "manual",
      completedAt: at(-5, 11, 30),
    },

    // ── Older completed ────────────────────────────────────────────────────
    // Shira · לק ג'ל · 20 days ago
    {
      client: shira, service: svcGel,
      start: at(-20, 10, 0),
      status: "completed", source: "manual",
      completedAt: at(-20, 11, 0),
    },

    // ── No-show (rule G) ───────────────────────────────────────────────────
    // Dana · הסרת לק ג'ל · 15 days ago
    {
      client: dana, service: svcRemove,
      start: at(-15, 14, 0),
      status: "no_show", source: "manual",
      noShowAt: at(-15, 14, 45),
    },

    // ── Cancelled ──────────────────────────────────────────────────────────
    // Lior · עיצוב גבות · 10 days ago
    {
      client: lior, service: svcBrows,
      start: at(-10, 12, 0),
      status: "cancelled", source: "manual",
      cancellationReason: "הלקוחה ביטלה בגלל עיסוקים אישיים",
      cancelledAt: at(-11, 18, 0),
    },

    // ── Retention clients — completed >30 days ago, no upcoming (rule F) ──
    // Roni · עיצוב גבות · 40 days ago
    {
      client: roni, service: svcBrows,
      start: at(-40, 11, 0),
      status: "completed", source: "manual",
      completedAt: at(-40, 11, 30),
    },
    // Mia · לק ג'ל · 45 days ago
    {
      client: mia, service: svcGel,
      start: at(-45, 10, 0),
      status: "completed", source: "manual",
      completedAt: at(-45, 11, 0),
    },
  ];

  const bookings = await Promise.all(
    defs.map((b) =>
      prisma.booking.create({
        data: {
          businessId: business.id,
          clientId: b.client.id,
          serviceId: b.service.id,
          startTime: b.start,
          endTime: endOf(b.start, b.service.durationMinutes),
          status: b.status,
          source: b.source,
          priceSnapshot: b.service.price,
          durationMinutesSnapshot: b.service.durationMinutes,
          notes: b.notes ?? null,
          cancellationReason: b.cancellationReason ?? null,
          cancelledAt: b.cancelledAt ?? null,
          completedAt: b.completedAt ?? null,
          noShowAt: b.noShowAt ?? null,
        },
      }),
    ),
  );
  console.log(`✔  Bookings   ${bookings.length}`);

  // ── 10. Client denormalized counters ──────────────────────────────────────
  // These drive the client profile display (totalSpent, lastVisitAt, etc.).
  await Promise.all([
    prisma.client.update({
      where: { id: noa.id },
      data: { lastVisitAt: at(-5, 10, 0), totalBookings: 2, totalSpent: 320 },
    }),
    prisma.client.update({
      where: { id: mia.id },
      data: { lastVisitAt: at(-45, 10, 0), totalBookings: 1, totalSpent: 180 },
    }),
    prisma.client.update({
      where: { id: shira.id },
      data: { lastVisitAt: at(-3, 11, 0), totalBookings: 3, totalSpent: 270 },
    }),
    prisma.client.update({
      where: { id: dana.id },
      data: { totalBookings: 3, noShowCount: 1 },
    }),
    prisma.client.update({
      where: { id: roni.id },
      data: { lastVisitAt: at(-40, 11, 0), totalBookings: 1, totalSpent: 90 },
    }),
    prisma.client.update({
      where: { id: lior.id },
      data: { totalBookings: 2, cancellationCount: 1 },
    }),
  ]);
  console.log(`✔  Client stats updated`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`
✅  Demo seed complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Login:        ${DEMO_EMAIL}
  Password:     ${DEMO_PASSWORD}
  Business:     הסטודיו של יעל
  Public link:  http://localhost:3000/b/${DEMO_SLUG}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
