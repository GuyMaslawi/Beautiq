/**
 * מחיקה מלאה של עסק וכל הנתונים שלו — מימוש "הזכות להימחק".
 *
 * מריצים משורש הפרויקט:
 *   npx tsx --env-file=.env scripts/delete-business.ts <slug>              # תצוגה בלבד
 *   npx tsx --env-file=.env scripts/delete-business.ts <slug> --confirm    # מחיקה בפועל
 *
 * ברירת המחדל היא **תצוגה בלבד (dry run)**: הסקריפט מדפיס בדיוק מה יימחק
 * ויוצא. מחיקה אמיתית דורשת --confirm, וגם אז מודפס סיכום לפני ואחרי.
 *
 * למה סקריפט ולא כפתור בממשק: זו פעולה בלתי הפיכה שמוחקת שנים של היסטוריית
 * לקוחות. היא צריכה להיות אפשרית (אחרת ההבטחה במדיניות הפרטיות ריקה), אבל
 * לא צריכה להיות במרחק קליק מבעלת עסק עייפה או ממנהל שלחץ על השורה הלא נכונה.
 *
 * המחיקה נשענת על onDelete: Cascade שמוגדר בסכימה על כל טבלה שמצביעה ל-Business
 * (לקוחות, תורים, שירותים, זמינות, הודעות, קמפיינים, נאמנות, לוג פעילות ועוד),
 * ולכן מחיקת שורת ה-Business אחת מנקה את כל השאר בעסקה אחת של מסד הנתונים.
 * חשבון המשתמשת (User) והמנוי שלו *אינם* נמחקים כאן — משתמשת יכולה להחזיק
 * יותר מעסק אחד, ותיעוד החיובים נשמר לצורכי חשבונאות. למחיקת חשבון המשתמשת
 * יש להשתמש ב---with-user.
 */

import { PrismaClient } from "@prisma/client";

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith("--"));
  const confirm = args.includes("--confirm");
  const withUser = args.includes("--with-user");

  if (!slug) {
    console.error(
      `${RED}שימוש:${RESET} npx tsx --env-file=.env scripts/delete-business.ts <slug> [--confirm] [--with-user]`,
    );
    process.exit(1);
  }

  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, createdAt: true },
  });

  if (!business) {
    console.error(`${RED}לא נמצא עסק עם ה-slug "${slug}".${RESET}`);
    process.exit(1);
  }

  const tenant = { businessId: business.id };

  // ספירה של מה שיימחק. לא רשימה ממצה של כל הטבלאות — אלה הנתונים
  // שמשמעותיים לבעלת העסק ושחשוב שתראה לפני שמאשרים.
  const [clients, bookings, services, reviews, expenses, messages, activity] =
    await Promise.all([
      prisma.client.count({ where: tenant }),
      prisma.booking.count({ where: tenant }),
      prisma.service.count({ where: tenant }),
      prisma.clientReview.count({ where: tenant }),
      prisma.expense.count({ where: tenant }),
      prisma.automationMessage.count({ where: tenant }),
      prisma.activityLog.count({ where: tenant }),
    ]);

  const owners = await prisma.businessUser.findMany({
    where: { businessId: business.id, role: "owner" },
    select: { user: { select: { id: true, email: true, name: true } } },
  });

  console.log("");
  console.log(`${BOLD}עסק:${RESET} ${business.name} (${business.slug})`);
  console.log(`${DIM}נוצר: ${business.createdAt.toISOString().slice(0, 10)}${RESET}`);
  console.log(`${DIM}בעלות: ${owners.map((o) => o.user.email).join(", ") || "—"}${RESET}`);
  console.log("");
  console.log(`${BOLD}יימחקו:${RESET}`);
  console.log(`  לקוחות:              ${clients}`);
  console.log(`  תורים:               ${bookings}`);
  console.log(`  שירותים:             ${services}`);
  console.log(`  ביקורות:             ${reviews}`);
  console.log(`  הוצאות:              ${expenses}`);
  console.log(`  הודעות אוטומטיות:    ${messages}`);
  console.log(`  רשומות לוג פעילות:   ${activity}`);
  console.log(
    `${DIM}  + זמינות, חריגות, תבניות, רשימת המתנה, קמפיינים, נאמנות, גלריה, חיבור WhatsApp${RESET}`,
  );
  console.log("");

  if (!confirm) {
    console.log(
      `${YELLOW}תצוגה בלבד — לא נמחק דבר.${RESET} להרצה אמיתית הוסיפו ${BOLD}--confirm${RESET}.`,
    );
    console.log(
      `${DIM}מומלץ לייצא קודם את הנתונים עבור בעלת העסק (הגדרות → הנתונים שלך).${RESET}`,
    );
    return;
  }

  // המחיקה עצמה — שורה אחת, וה-cascade עושה את השאר.
  await prisma.business.delete({ where: { id: business.id } });
  console.log(`${GREEN}✓ העסק "${business.name}" וכל נתוניו נמחקו.${RESET}`);

  if (withUser) {
    // רק בעלות שאין להן עסק נוסף — אחרת המחיקה תנתק אותן מעסק פעיל.
    for (const { user } of owners) {
      const remaining = await prisma.businessUser.count({
        where: { userId: user.id },
      });
      if (remaining > 0) {
        console.log(
          `${YELLOW}⚠ ${user.email} עדיין משויכת ל-${remaining} עסקים — החשבון לא נמחק.${RESET}`,
        );
        continue;
      }
      await prisma.user.delete({ where: { id: user.id } });
      console.log(`${GREEN}✓ חשבון המשתמשת ${user.email} נמחק.${RESET}`);
    }
  } else if (owners.length > 0) {
    console.log(
      `${DIM}חשבונות המשתמשות נשמרו. למחיקתם הריצו שוב עם --with-user.${RESET}`,
    );
  }
}

main()
  .catch((err) => {
    console.error(`${RED}המחיקה נכשלה:${RESET}`, err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
