/**
 * בדיקת תצורת האימייל מקצה לקצה.
 *
 * מריצים משורש הפרויקט:
 *   npx tsx --env-file=.env scripts/send-test-email.ts you@example.com
 *
 * למה זה קיים: שחזור הסיסמה ("שכחתי סיסמה") נשען כולו על שליחת אימייל.
 * sendEmail נכשל בשקט בכוונה — הוא לעולם לא שובר זרימה עסקית — ולכן תצורה
 * חסרה או שגויה נראית בדיוק כמו הצלחה מבחוץ. הסקריפט הזה הופך את זה לרועש:
 * הוא משתמש באותו קוד שליחה בדיוק שהאפליקציה משתמשת בו, ומדווח מה קרה.
 *
 * לא שולח לאף לקוחה — רק לכתובת שמעבירים לו בשורת הפקודה.
 */

import { sendEmail, isEmailConfigured } from "@/lib/email/send";

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";

function mask(value: string | undefined): string {
  if (!value) return `${RED}חסר${RESET}`;
  if (value.length <= 8) return `${GREEN}מוגדר${RESET} ${DIM}(${value.length} תווים)${RESET}`;
  return `${GREEN}מוגדר${RESET} ${DIM}(${value.slice(0, 4)}…${value.slice(-2)})${RESET}`;
}

async function main() {
  const to = process.argv[2];

  console.log("\n=== בדיקת תצורת אימייל ===\n");
  console.log(`  RESEND_API_KEY   ${mask(process.env.RESEND_API_KEY?.trim())}`);
  console.log(`  EMAIL_FROM       ${process.env.EMAIL_FROM?.trim() ?? `${RED}חסר${RESET}`}`);
  console.log();

  if (!isEmailConfigured()) {
    console.log(`${RED}✖ האימייל אינו מוגדר.${RESET}`);
    console.log("  שחזור סיסמה לא ישלח כלום עד שיוגדרו שני המשתנים.\n");
    process.exit(1);
  }

  // EMAIL_FROM חייב להיות כתובת שהדומיין שלה מאומת ב-Resend, אחרת Resend
  // דוחה את השליחה. בדיקת צורה בסיסית מונעת בלבול נפוץ (שם בלי כתובת).
  const from = process.env.EMAIL_FROM!.trim();
  if (!/@/.test(from)) {
    console.log(`${RED}✖ EMAIL_FROM אינו נראה ככתובת אימייל.${RESET}`);
    console.log(`  צורה תקינה:  Allura <noreply@allura.info>\n`);
    process.exit(1);
  }

  if (!to) {
    console.log(`${YELLOW}התצורה קיימת. לשליחת מייל בדיקה אמיתי:${RESET}`);
    console.log("  npx tsx --env-file=.env scripts/send-test-email.ts you@example.com\n");
    return;
  }

  console.log(`שולח מייל בדיקה אל ${to}…\n`);

  const result = await sendEmail({
    to,
    subject: "בדיקת תצורת אימייל — Allura",
    text: [
      "זהו מייל בדיקה מ-Allura.",
      "",
      "אם הגיע אליך — תצורת האימייל תקינה, ושחזור סיסמה יעבוד.",
    ].join("\n"),
    html: `<!doctype html><html dir="rtl" lang="he"><body style="font-family:'Segoe UI',Arial,sans-serif;background:#faf7f8;margin:0">
      <div style="max-width:440px;margin:0 auto;padding:24px">
        <div style="background:#fff;border:1px solid #efe6ec;border-radius:16px;padding:24px">
          <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#2b2229">בדיקת תצורת אימייל</p>
          <p style="margin:0;color:#8a7f86;font-size:14px;line-height:22px">
            אם ההודעה הזו הגיעה אליך — תצורת האימייל של Allura תקינה, ושחזור סיסמה יעבוד.
          </p>
        </div>
      </div></body></html>`,
  });

  if (result.ok) {
    console.log(`${GREEN}✔ נשלח בהצלחה.${RESET}  id=${result.id ?? "—"}`);
    console.log("  כדאי לוודא שההודעה אכן הגיעה (כולל תיקיית ספאם).\n");
    return;
  }

  if ("skipped" in result && result.skipped) {
    console.log(`${RED}✖ דולג — התצורה חסרה.${RESET} (${result.reason})\n`);
    process.exit(1);
  }

  console.log(`${RED}✖ השליחה נכשלה.${RESET} (${result.reason})`);
  console.log(`\n${DIM}סיבות נפוצות:${RESET}`);
  console.log("  • provider_status_403 — הדומיין ב-EMAIL_FROM אינו מאומת ב-Resend");
  console.log("  • provider_status_401 — מפתח API שגוי או שנמחק");
  console.log("  • provider_status_422 — כתובת השולח או הנמען אינה תקינה");
  console.log(
    `  • בחשבון Resend חדש ללא דומיין מאומת אפשר לשלוח רק מ-onboarding@resend.dev,\n` +
      "    ורק אל כתובת האימייל שאיתה נרשמת.\n",
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("שגיאה לא צפויה:", err);
  process.exit(1);
});
