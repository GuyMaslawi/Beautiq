/**
 * בדיקת מצב אימות הדומיין ב-Resend, והפעלת אימות מחדש.
 *
 * מריצים משורש הפרויקט:
 *   npx tsx --env-file=.env scripts/check-email-domain.ts
 *   npx tsx --env-file=.env scripts/check-email-domain.ts --verify
 *
 * למה: כל עוד הדומיין אינו מאומת, Resend דוחה כל שליחה מ-noreply@allura.info
 * ב-403 — כלומר שחזור הסיסמה "מצליח" בממשק אך אף מייל לא יוצא. הסקריפט הזה
 * מראה בדיוק אילו רשומות DNS כבר נקלטו ואילו עדיין חסרות.
 */

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";

interface DomainRecord {
  record: string;
  name: string;
  type: string;
  value: string;
  priority?: number;
  status: string;
}
interface Domain {
  id: string;
  name: string;
  status: string;
  region?: string;
  records?: DomainRecord[];
}

function statusColor(s: string): string {
  if (s === "verified") return `${GREEN}${s}${RESET}`;
  if (s === "failed" || s === "temporary_failure") return `${RED}${s}${RESET}`;
  return `${YELLOW}${s}${RESET}`;
}

async function api(path: string, key: string, method = "GET") {
  const res = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}` },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function main() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.log(`${RED}✖ RESEND_API_KEY אינו מוגדר.${RESET}\n`);
    process.exit(1);
  }

  const list = await api("/domains", key);
  if (list.status === 401) {
    console.log(`${RED}✖ המפתח נדחה (401) — לא תקין או שנמחק.${RESET}\n`);
    process.exit(1);
  }

  const domains: Domain[] = (list.body as { data?: Domain[] }).data ?? [];
  if (domains.length === 0) {
    console.log(`${YELLOW}אין דומיינים בחשבון Resend.${RESET}\n`);
    return;
  }

  const wantVerify = process.argv.includes("--verify");

  for (const d of domains) {
    if (wantVerify) await api(`/domains/${d.id}/verify`, key, "POST");

    // מושכים שוב כדי לקבל את מצב הרשומות המעודכן.
    const full = await api(`/domains/${d.id}`, key);
    const dom = full.body as Domain;

    console.log(`\n=== ${dom.name} ===`);
    console.log(`  מצב כולל: ${statusColor(dom.status)}   ${DIM}(${dom.region ?? "—"})${RESET}\n`);

    for (const r of dom.records ?? []) {
      const host = r.name === "@" ? dom.name : `${r.name}.${dom.name}`;
      console.log(`  ${statusColor(r.status).padEnd(22)} ${r.type.padEnd(4)} ${host}`);
      console.log(`  ${DIM}${r.value}${RESET}`);
      if (r.priority != null) console.log(`  ${DIM}priority ${r.priority}${RESET}`);
      console.log();
    }

    if (dom.status === "verified") {
      console.log(`${GREEN}✔ הדומיין מאומת — אפשר לשלוח מ-noreply@${dom.name}${RESET}`);
      console.log(`${DIM}  לבדיקה אמיתית: npx tsx --env-file=.env scripts/send-test-email.ts you@example.com${RESET}\n`);
    } else {
      console.log(`${YELLOW}⏳ עדיין לא מאומת.${RESET}`);
      console.log(`${DIM}  יש להוסיף את הרשומות שלמעלה אצל הרשם של ${dom.name}, ואז:${RESET}`);
      console.log(`${DIM}  npx tsx --env-file=.env scripts/check-email-domain.ts --verify${RESET}`);
      console.log(`${DIM}  (התפשטות DNS יכולה לקחת בין דקות לכמה שעות)${RESET}\n`);
    }
  }
}

main().catch((err) => {
  console.error("שגיאה לא צפויה:", err);
  process.exit(1);
});
