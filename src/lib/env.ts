/**
 * אימות משתני סביבה (environment variables) באתחול.
 *
 * המטרה: להיכשל מהר וברור. במקום שקריאה חסרה של DATABASE_URL או CRON_SECRET
 * תתפוצץ באמצע בקשה בייצור — אנו בודקים את כל המשתנים הנדרשים פעם אחת
 * בעליית השרת (דרך instrumentation.ts) ומדווחים רשימה מרוכזת.
 *
 * כדי לא להוסיף תלות חיצונית (CLAUDE.md §4: להימנע מספריות מיותרות) האימות
 * נכתב ידנית — בדומה לשאר ולידציות הקלט בפרויקט (src/lib/validation/*).
 *
 * המודול אינו זורק מעצמו; הוא מחזיר errors/warnings ומשאיר את ההחלטה
 * (לזרוק בפרודקשן / להזהיר בפיתוח) ל-instrumentation.ts.
 */

function isSet(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

function isTrue(name: string): boolean {
  return (process.env[name] ?? "").trim().toLowerCase() === "true";
}

export interface EnvCheckResult {
  errors: string[];
  warnings: string[];
}

/**
 * בודק את כל המשתנים הנדרשים. משתנים מותנים נבדקים רק כאשר הפיצ'ר
 * שמשתמש בהם מופעל (למשל אימות חתימת תשלומים נדרש רק כשהתשלומים פעילים).
 */
export function checkEnv(): EnvCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = process.env.NODE_ENV === "production";

  // ── נדרשים תמיד ──────────────────────────────────────────────
  if (!isSet("DATABASE_URL")) {
    errors.push("DATABASE_URL חסר — אין חיבור למסד הנתונים.");
  }

  // ── מאגר חיבורים (connection pool) — קריטי לעומס בסביבת serverless ──
  // ב-Vercel כל בקשה בו-זמנית עשויה להריץ מופע serverless נפרד, וכל מופע
  // פותח חיבור Postgres משלו. בלי pooler חיצוני (PgBouncer / Neon-pooler),
  // עומס של עשרות-מאות משתמשות במקביל מגיע לתקרת החיבורים ומחזיר
  // "too many connections". הבדיקה רצה בפרודקשן האמיתי (process.env אמיתי שם)
  // ולכן תתפוס תצורה שגויה שלא ניתן לראות מקומית. אזהרה בלבד — לא חוסמת עלייה.
  if (isProd && isSet("DATABASE_URL")) {
    const dbUrl = (process.env.DATABASE_URL ?? "").toLowerCase();
    const looksPooled =
      /-pooler\./.test(dbUrl) || // Neon/Supabase pooled host
      /pgbouncer=true/.test(dbUrl) ||
      /[?&]connection_limit=/.test(dbUrl);
    if (!looksPooled) {
      warnings.push(
        "DATABASE_URL אינו נראה כמו חיבור מפולל (pooler) — בסביבת serverless תחת עומס " +
          "זה עלול להגיע לתקרת החיבורים. השתמשו ב-endpoint של ה-pooler והוסיפו " +
          "?pgbouncer=true&connection_limit=1 (Neon/Supabase). ראו load-test/README.md.",
      );
    }
    // DIRECT_URL מוגדר אך schema.prisma חייב להכריז directUrl כדי שמיגרציות
    // ירוצו בחיבור ישיר בזמן ש-runtime משתמש ב-pooler. אם הוא מוגדר בלי הכרזה,
    // סביר שהחיווט לא הושלם.
    if (isSet("DIRECT_URL") && !looksPooled) {
      warnings.push(
        "DIRECT_URL מוגדר אך DATABASE_URL אינו מפולל — ודאו ש-schema.prisma מגדיר " +
          "directUrl = env(\"DIRECT_URL\") ו-DATABASE_URL מצביע ל-pooler.",
      );
    }
  }
  if (!isSet("AUTH_SECRET")) {
    errors.push("AUTH_SECRET חסר — נדרש לחתימת סשנים (openssl rand -base64 32).");
  }

  // ── נדרשים בפרודקשן בלבד ─────────────────────────────────────
  if (isProd) {
    if (!isSet("CRON_SECRET")) {
      errors.push("CRON_SECRET חסר — משימות ה-cron יידחו (401) ללא טוקן.");
    }
    if (!isSet("NEXT_PUBLIC_APP_URL")) {
      warnings.push(
        "NEXT_PUBLIC_APP_URL לא מוגדר — נעשה שימוש בברירת המחדל https://allura.info לקישורים חיצוניים.",
      );
    }
    // התראת אימייל לבעלת העסק על בקשת תור חדשה היא best-effort. אם אינה מוגדרת
    // בייצור — לא יישלח אימייל (ההזמנה עדיין נוצרת ומופיעה בלוח הבקרה).
    if (!isSet("RESEND_API_KEY") || !isSet("EMAIL_FROM")) {
      warnings.push(
        "RESEND_API_KEY / EMAIL_FROM לא מוגדרים — התראות אימייל לבעלת העסק על בקשות תור חדשות לא יישלחו.",
      );
    }
  }

  // ── WhatsApp — נבדק רק כששליחה אמיתית מופעלת ──────────────────
  if (isTrue("ENABLE_REAL_WHATSAPP_SEND")) {
    const required = [
      "META_WHATSAPP_ACCESS_TOKEN",
      "META_WHATSAPP_PHONE_NUMBER_ID",
    ];
    for (const name of required) {
      if (!isSet(name)) {
        errors.push(
          `${name} חסר — ENABLE_REAL_WHATSAPP_SEND=true אך פרטי Meta WhatsApp לא מלאים.`,
        );
      }
    }
    if (isProd && !isSet("META_WEBHOOK_APP_SECRET")) {
      errors.push(
        "META_WEBHOOK_APP_SECRET חסר — אימות חתימת ה-Webhook ייכשל (נדרש בפרודקשן).",
      );
    }
    if (isProd && !isSet("META_WEBHOOK_VERIFY_TOKEN")) {
      warnings.push(
        "META_WEBHOOK_VERIFY_TOKEN לא מוגדר — אימות רישום ה-Webhook מול Meta ייכשל.",
      );
    }
    // טוקני עסקים מוצפנים נשמרים רק כשמשתמשים ב-Embedded Signup; אם הדגל
    // אינו מופעל אך אין fallback מהסביבה — לא ניתן יהיה לשלוח כלל.
    if (!isTrue("WHATSAPP_USE_ENV_FALLBACK") && !isSet("WHATSAPP_CREDENTIALS_ENCRYPTION_KEY")) {
      warnings.push(
        "WHATSAPP_CREDENTIALS_ENCRYPTION_KEY לא מוגדר — חיבור WhatsApp פר-עסק (Embedded Signup) לא יעבוד.",
      );
    }
  }

  // ── מצב בדיקה שעלול לדלוף לייצור ─────────────────────────────
  if (isProd && isTrue("WHATSAPP_TEST_MODE")) {
    warnings.push(
      "WHATSAPP_TEST_MODE=true בפרודקשן — שליחה אמיתית מותרת רק ל-WHATSAPP_TEST_PHONE. כבו זאת לשליחה לכלל הלקוחות.",
    );
  }

  // ── מנויים (Grow דרך Make) — נבדק רק כשחיוב המנויים מופעל ─────────────
  if (isTrue("SUBSCRIPTIONS_ENABLED")) {
    // יצירת קישור התשלום מתווכת דרך תרחיש Make; פרטי Grow עצמם שמורים ב-Make,
    // לכן אצלנו נדרש רק כתובת ה-Webhook של התרחיש.
    if (!isSet("MAKE_GROW_CREATE_LINK_WEBHOOK_URL")) {
      errors.push(
        "MAKE_GROW_CREATE_LINK_WEBHOOK_URL חסר — SUBSCRIPTIONS_ENABLED=true אך כתובת ה-Webhook של Make ליצירת קישור התשלום לא מוגדרת.",
      );
    }
    if (isProd && !isSet("NEXT_PUBLIC_APP_URL")) {
      errors.push(
        "NEXT_PUBLIC_APP_URL חסר — נדרש כדי לבנות את כתובת ה-notifyUrl שאליה Grow מדווח על התשלום.",
      );
    }
  }

  return { errors, warnings };
}
