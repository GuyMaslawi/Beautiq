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
import { getMetaTokenStatus } from "@/server/ops/meta-token";
import {
  countOverdueRenewals,
  countDirectDebitsAwaitingStop,
} from "@/server/subscription/service";

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
  /**
   * מתי התמונה הזו נלקחה. נקבע כאן ולא בקומפוננטה — גם כדי שהזמן יהיה אחיד
   * לכל המסך (הזמן היחסי של כל משימה נמדד מולו), וגם כי קריאה לשעון בזמן
   * render אינה דטרמיניסטית.
   */
  checkedAt: Date;
}

export async function getLaunchReadiness(): Promise<LaunchReadiness> {
  const checkedAt = new Date();
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

  // 1ב. הטוקן של Meta. טוקן משתמש רגיל פג אחרי 60 יום ואז ההודעות מתות באמצע
  // החודש. זו הבדיקה היחידה כאן שיוצאת החוצה לרשת — היא שואלת את Meta מה מצב
  // הטוקן שמוגדר בפועל, כי הערך עצמו מוצפן ואי אפשר לקרוא אותו.
  const meta = await getMetaTokenStatus();
  if (!meta.configured) {
    checks.push({
      key: "meta-token",
      label: "טוקן Meta",
      level: "blocker",
      detail: "לא מוגדר `META_WHATSAPP_ACCESS_TOKEN` — לא נשלחת אף הודעה.",
      action: "להנפיק טוקן System User ולהגדיר אותו בפרודקשן.",
    });
  } else if (meta.checkFailed) {
    checks.push({
      key: "meta-token",
      label: "טוקן Meta",
      level: "warn",
      detail: `לא הצלחנו לאמת מול Meta (${meta.error ?? "שגיאה לא ידועה"}). ייתכן שזו תקלת רשת זמנית.`,
      action: "לרענן; אם זה חוזר — לבדוק את הטוקן ב-Access Token Debugger של Meta.",
    });
  } else if (!meta.valid) {
    checks.push({
      key: "meta-token",
      label: "טוקן Meta",
      level: "blocker",
      detail: "Meta מדווחת שהטוקן אינו תקף — ההודעות לא נשלחות (שגיאה 190).",
      action: "להנפיק טוקן חדש של System User (ללא תפוגה) ולהחליף בפרודקשן.",
    });
  } else if (meta.neverExpires) {
    checks.push({
      key: "meta-token",
      label: "טוקן Meta",
      level: "ok",
      detail: `תקף וללא תפוגה${meta.type ? ` (${meta.type})` : ""} — זהו טוקן קבוע.`,
    });
  } else {
    // תקף אך זמני: זו בדיוק הפצצה המתקתקת.
    const days = meta.daysLeft ?? 0;
    checks.push({
      key: "meta-token",
      label: "טוקן Meta",
      level: days <= 14 ? "blocker" : "warn",
      detail:
        `הטוקן תקף אך פג בעוד ${days} ימים` +
        `${meta.expiresAt ? ` (${meta.expiresAt.toLocaleDateString("he-IL")})` : ""}` +
        `${meta.type ? ` — סוג: ${meta.type}` : ""}. כשזה יקרה ההודעות יפסיקו להישלח בלי התראה.`,
      action: "להחליף בטוקן של System User שהונפק עם expiration=Never.",
    });
  }

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

  // 4ב. חידושים שלא הגיעו. זו הבדיקה היחידה שחושפת את הכשל השקט של החיוב
  // החוזר: מנוי שנשאר `active` אחרי סוף התקופה שלו הוא מנוי שממשיך לקבל גישה
  // מלאה בלי ששולם עליו. אין שום מקום אחר במערכת שמסתכל על זה.
  let overdue = 0;
  let overdueCheckFailed = false;
  try {
    overdue = await countOverdueRenewals(checkedAt);
  } catch {
    overdueCheckFailed = true;
  }
  checks.push({
    key: "renewals-overdue",
    label: "חידושי מנוי שלא התקבלו",
    level: overdueCheckFailed ? "warn" : overdue > 0 ? "blocker" : "ok",
    detail: overdueCheckFailed
      ? "לא הצלחנו לבדוק — שגיאה בקריאה מהמסד."
      : overdue > 0
        ? `${overdue} מנויים פעילים עברו את מועד החידוש ולא התקבל עבורם חיוב מ-Grow. הגישה שלהם פתוחה בלי תשלום.`
        : "לכל המנויים הפעילים התקבל חיוב בתקופה הנוכחית.",
    action:
      overdue > 0
        ? "לבדוק ב-Grow אם הוראת הקבע עדיין פעילה, וב-/admin/subscriptions אם נרשם חיוב חוזר."
        : undefined,
  });

  // 4ג. עצירת החיוב בביטול מנוי. Grow מציינת בתיעוד של אפליקציית Make שלה
  // שביטול תשלום חוזר אינו אפשרי דרך Make ויש לבצעו באתר שלה — כלומר זו פעולה
  // ידנית מעצם הגדרתה, ולא פער תצורה שאפשר לסגור במשתנה סביבה. מה שנמדד כאן
  // הוא לכן לא "האם זה מוגדר" אלא "כמה לקוחות מחויבות בזה הרגע".
  let awaitingStop = 0;
  let stopCheckFailed = false;
  try {
    awaitingStop = await countDirectDebitsAwaitingStop();
  } catch {
    stopCheckFailed = true;
  }
  checks.push({
    key: "billing-cancel",
    label: "עצירת חיוב בביטול מנוי",
    level: stopCheckFailed ? "warn" : awaitingStop > 0 ? "blocker" : "ok",
    detail: stopCheckFailed
      ? "לא הצלחנו לבדוק — שגיאה בקריאה מהמסד."
      : awaitingStop > 0
        ? `${awaitingStop} הוראות קבע עדיין פעילות ב-Grow למנויים שכבר בוטלו — כלומר לקוחות שביטלו וממשיכות להיות מחויבות.`
        : "אין הוראות קבע שממתינות לעצירה.",
    action:
      awaitingStop > 0
        ? "לעצור אותן בלוח הבקרה של Grow ולסמן ברשימה שבתחתית המסך."
        : undefined,
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

  const crons = await getCronHealth(checkedAt);

  const blockers =
    checks.filter((c) => c.level === "blocker").length + crons.filter((c) => c.stale).length;
  const warnings = checks.filter((c) => c.level === "warn").length;

  return { checks, crons, blockers, warnings, checkedAt };
}
