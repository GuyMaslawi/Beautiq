/**
 * מצב המערכת להשקה — מה שעד היום היה אפשר לראות רק דרך `/api/health` עם
 * `CRON_SECRET` ביד.
 *
 * הדברים שמפילים השקה אינם באגים בקוד אלא תצורה: מצב בדיקה של WhatsApp שנשאר
 * דלוק ואף לקוחה לא מקבלת הודעה, ערוץ התראות שלא חובר, חיוב שלא מוגדר, משימות
 * מתוזמנות שלא רצות. כולם שקטים לחלוטין מבפנים. המסך `/admin/ops` מציג אותם.
 *
 * Server-only, למנהלי פלטפורמה בלבד.
 */

import { getCronHealth, type CronHealthRow } from "@/server/ops/cron-heartbeat";

function isSet(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

function isTrue(name: string): boolean {
  return (process.env[name] ?? "").trim().toLowerCase() === "true";
}

/** חומרת ממצא: `blocker` חוסם השקה, `warn` שווה טיפול, `ok` תקין. */
export type CheckLevel = "ok" | "warn" | "blocker";

export interface ReadinessCheck {
  key: string;
  label: string;
  level: CheckLevel;
  /** מה המצב בפועל, בשפה של בן אדם. */
  detail: string;
  /** מה לעשות — רק כשיש מה. */
  action?: string;
}

export interface LaunchReadiness {
  checks: ReadinessCheck[];
  crons: CronHealthRow[];
  blockers: number;
  warnings: number;
}

export async function getLaunchReadiness(): Promise<LaunchReadiness> {
  const checks: ReadinessCheck[] = [];

  // 1. מצב בדיקה של WhatsApp — הפער היחיד שגורם לכך שכלום לא נשלח, בלי שגיאה.
  const testMode = isTrue("WHATSAPP_TEST_MODE");
  checks.push({
    key: "whatsapp-test-mode",
    label: "שליחת WhatsApp ללקוחות",
    level: testMode ? "blocker" : "ok",
    detail: testMode
      ? "מצב בדיקה דלוק — הודעות נשלחות רק למספר הבדיקה. אף לקוחה של אף עסק לא מקבלת דבר."
      : "מצב בדיקה כבוי — הודעות נשלחות ללקוחות אמיתיות.",
    action: testMode ? "להסיר את WHATSAPP_TEST_MODE מהסביבה בפרודקשן ולפרוס מחדש." : undefined,
  });

  const realSend = isTrue("ENABLE_REAL_WHATSAPP_SEND");
  checks.push({
    key: "whatsapp-real-send",
    label: "שליחה אמיתית מופעלת",
    level: realSend ? "ok" : "blocker",
    detail: realSend
      ? "ENABLE_REAL_WHATSAPP_SEND דלוק."
      : "ENABLE_REAL_WHATSAPP_SEND כבוי — ההודעות נרשמות בלבד ולא יוצאות.",
    action: realSend ? undefined : "להגדיר ENABLE_REAL_WHATSAPP_SEND=true בפרודקשן.",
  });

  // 2. ערוץ התראות. לוג אינו ניטור.
  const alertWebhook = isSet("ERROR_ALERT_WEBHOOK_URL");
  const alertEmail = isSet("ERROR_ALERT_EMAIL");
  checks.push({
    key: "error-alerts",
    label: "התראות על שגיאות",
    level: alertWebhook || alertEmail ? "ok" : "blocker",
    detail:
      alertWebhook && alertEmail
        ? "מוגדרים גם Webhook וגם אימייל."
        : alertWebhook
          ? "מוגדר Webhook."
          : alertEmail
            ? "מוגדר אימייל התראות."
            : "אין ערוץ התראות — שגיאה בפרודקשן נכתבת ללוג ואיש לא יודע עליה.",
    action:
      alertWebhook || alertEmail
        ? undefined
        : "להגדיר ERROR_ALERT_EMAIL (הכי מהיר, עובד דרך Resend הקיים).",
  });

  // 3. אימייל — תזכורות ניסיון, שחזור סיסמה והתראה על תור חדש תלויים בו.
  const emailOk = isSet("RESEND_API_KEY") && isSet("EMAIL_FROM");
  checks.push({
    key: "email",
    label: "שליחת אימייל",
    level: emailOk ? "ok" : "blocker",
    detail: emailOk
      ? "Resend מוגדר — שחזור סיסמה, התראות תור חדש ותזכורות סוף ניסיון נשלחים."
      : "לא מוגדר — שחזור סיסמה ותזכורות סוף תקופת ניסיון לא יישלחו.",
    action: emailOk ? undefined : "להגדיר RESEND_API_KEY ו-EMAIL_FROM.",
  });

  // 4. חיוב.
  const billingOk = isTrue("SUBSCRIPTIONS_ENABLED") && isSet("MAKE_GROW_CREATE_LINK_WEBHOOK_URL");
  checks.push({
    key: "billing",
    label: "חיוב מנויים (Grow)",
    level: billingOk ? "ok" : "blocker",
    detail: billingOk
      ? "מוגדר — בעלת עסק חדשה יכולה לשלם ולהיכנס."
      : "לא מוגדר — מסך התשלום חוסם את עצמו ואף נרשמת חדשה לא תוכל להיכנס (מלבד מי שקיבלה גישה ידנית).",
    action: billingOk ? undefined : "להגדיר SUBSCRIPTIONS_ENABLED=true ואת ה-Webhook של Grow.",
  });

  const webhookSecret = isSet("SUBSCRIPTION_WEBHOOK_SECRET");
  checks.push({
    key: "subscription-webhook-secret",
    label: "אימות הודעות החיוב מ-Grow",
    level: webhookSecret ? "ok" : "blocker",
    detail: webhookSecret
      ? "מוגדר — רק הודעות שמגיעות עם הסוד מתקבלות."
      : "לא מוגדר — נקודת הקצה שמאשרת תשלומים אינה מאומתת.",
    action: webhookSecret ? undefined : "להגדיר SUBSCRIPTION_WEBHOOK_SECRET בפרודקשן.",
  });

  // 5. שם הישות המשפטית — מוצג בעמודים הציבוריים ובמסמכים המשפטיים.
  const legal = isSet("NEXT_PUBLIC_LEGAL_ENTITY_NAME");
  checks.push({
    key: "legal-entity",
    label: "שם הישות המשפטית",
    level: legal ? "ok" : "warn",
    detail: legal
      ? "מוגדר ומוצג בתחתית העמודים הציבוריים."
      : "לא מוגדר — העמודים הציבוריים והמסמכים המשפטיים לא מציגים מי מפעיל את השירות.",
    action: legal ? undefined : "להגדיר NEXT_PUBLIC_LEGAL_ENTITY_NAME (שם העוסק/החברה).",
  });

  // 6. מפתחות תשתית.
  const blob = isSet("BLOB_READ_WRITE_TOKEN");
  checks.push({
    key: "blob",
    label: "העלאת תמונות",
    level: blob ? "ok" : "warn",
    detail: blob ? "אחסון Vercel Blob מחובר." : "לא מחובר — העלאת תמונות לגלריה תיכשל.",
    action: blob ? undefined : "לחבר Vercel Blob (Storage → Blob).",
  });

  const encKey = isSet("WHATSAPP_CREDENTIALS_ENCRYPTION_KEY");
  checks.push({
    key: "wa-encryption",
    label: "הצפנת אישורי WhatsApp",
    level: encKey ? "ok" : "warn",
    detail: encKey ? "מפתח ההצפנה מוגדר." : "לא מוגדר — חיבור WhatsApp עצמאי של עסק לא יעבוד.",
  });

  const crons = await getCronHealth();

  const blockers =
    checks.filter((c) => c.level === "blocker").length + crons.filter((c) => c.stale).length;
  const warnings = checks.filter((c) => c.level === "warn").length;

  return { checks, crons, blockers, warnings };
}
