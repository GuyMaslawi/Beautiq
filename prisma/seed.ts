/**
 * Prisma seed — Allura
 *
 * Seeds ONLY safe development/reference data:
 *   1. BusinessCategory        — fixed beauty/wellness categories (Hebrew names).
 *   2. SystemMessageTemplate   — system-wide default WhatsApp-ready templates (Hebrew).
 *
 * It deliberately does NOT create fake businesses, clients, bookings, payments,
 * or per-business MessageTemplate overrides. The seed is idempotent: it can be
 * run repeatedly and keeps the reference data in sync without duplicates.
 *
 * Run with:  npm run db:seed   (or `npx prisma db seed`)
 */

import {
  BusinessCategoryKey,
  MessageTemplateType,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();

/** Fixed beauty/wellness categories with their Hebrew display names. */
const CATEGORIES: { key: BusinessCategoryKey; nameHe: string }[] = [
  { key: BusinessCategoryKey.nails, nameHe: "ציפורניים" },
  { key: BusinessCategoryKey.brows, nameHe: "גבות" },
  { key: BusinessCategoryKey.lashes, nameHe: "ריסים" },
  { key: BusinessCategoryKey.hair, nameHe: "שיער" },
  { key: BusinessCategoryKey.makeup, nameHe: "איפור" },
  { key: BusinessCategoryKey.cosmetics, nameHe: "קוסמטיקה" },
  { key: BusinessCategoryKey.laser, nameHe: "הסרת שיער בלייזר" },
  { key: BusinessCategoryKey.aesthetics, nameHe: "טיפולי אסתטיקה" },
  { key: BusinessCategoryKey.massage, nameHe: "עיסוי" },
  { key: BusinessCategoryKey.spa, nameHe: "ספא" },
  { key: BusinessCategoryKey.permanent_makeup, nameHe: "איפור קבוע" },
  { key: BusinessCategoryKey.other, nameHe: "אחר" },
];

/**
 * System-wide default message templates (Hebrew).
 *
 * Bodies use dynamic variables in {curlyBraces}:
 *   {clientName} {businessName} {serviceName} {bookingDate} {bookingTime}
 *   {price}
 */
const SYSTEM_TEMPLATES: {
  type: MessageTemplateType;
  title: string;
  body: string;
}[] = [
  {
    type: MessageTemplateType.booking_confirmation,
    title: "אישור תור",
    body: "היי {clientName}, התור שלך ל{serviceName} אצל {businessName} נקבע ל{bookingDate} בשעה {bookingTime}. נשמח לראות אותך ❤️",
  },
  {
    type: MessageTemplateType.booking_reminder,
    title: "תזכורת לתור",
    body: "היי {clientName}, רק תזכורת קטנה לתור שלך ל{serviceName} מחר ב{bookingTime}. נתראה ב{businessName} ❤️",
  },
  {
    type: MessageTemplateType.booking_cancelled,
    title: "ביטול תור",
    body: "היי {clientName}, התור שלך ל{serviceName} בתאריך {bookingDate} בוטל. נשמח לקבוע מועד חדש שמתאים לך 🙏",
  },
  {
    type: MessageTemplateType.booking_rescheduled,
    title: "שינוי מועד תור",
    body: "היי {clientName}, מועד התור שלך ל{serviceName} עודכן ל{bookingDate} בשעה {bookingTime}. נתראה ב{businessName} ❤️",
  },
  {
    type: MessageTemplateType.after_treatment,
    title: "אחרי הטיפול",
    body: "היי {clientName}, תודה שהגעת אלינו ל{businessName} 💕 מקווים שנהנית! נשמח לשמוע איך הרגשת ולראות אותך שוב בקרוב.",
  },
  {
    type: MessageTemplateType.rebook_reminder,
    title: "הזמנה לקביעת תור חדש",
    body: "היי {clientName}, מזמן לא התראינו! בא לך לקבוע תור חדש ל{serviceName} אצל {businessName}? נשמח לראות אותך שוב ❤️",
  },
  {
    type: MessageTemplateType.empty_slot_offer,
    title: "הצעת חלון פנוי",
    body: "היי {clientName}, התפנה אצלנו חלון ל{serviceName} ב{bookingDate} בשעה {bookingTime}. רוצה שנשמור לך אותו? 😊",
  },
  {
    type: MessageTemplateType.waitlist_offer,
    title: "הצעה מרשימת המתנה",
    body: "היי {clientName}, התפנה מקום ל{serviceName} אצל {businessName} ב{bookingDate} בשעה {bookingTime}. רוצה לתפוס אותו? ❤️",
  },
];

async function seedCategories() {
  for (const category of CATEGORIES) {
    await prisma.businessCategory.upsert({
      where: { key: category.key },
      update: { nameHe: category.nameHe },
      create: category,
    });
  }
  console.log(`✔ Seeded ${CATEGORIES.length} business categories`);
}

async function seedSystemTemplates() {
  // SystemMessageTemplate.type is unique, so a plain upsert keyed on type keeps
  // this idempotent — exactly one system default per template type.
  for (const template of SYSTEM_TEMPLATES) {
    await prisma.systemMessageTemplate.upsert({
      where: { type: template.type },
      update: { title: template.title, body: template.body },
      create: {
        type: template.type,
        title: template.title,
        body: template.body,
      },
    });
  }
  console.log(`✔ Seeded ${SYSTEM_TEMPLATES.length} system message templates`);
}

async function main() {
  await seedCategories();
  await seedSystemTemplates();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
