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

  // ── תשלומים — נבדק רק כשהתשלומים מופעלים ──────────────────────
  if (isTrue("PAYMENTS_ENABLED")) {
    const provider = (process.env.PAYMENT_PROVIDER ?? "").trim();
    const isRealProvider = provider !== "" && provider !== "mock" && provider !== "disabled";
    if (isRealProvider) {
      if (!isSet("PAYMENTS_CREDENTIALS_ENCRYPTION_KEY")) {
        errors.push(
          "PAYMENTS_CREDENTIALS_ENCRYPTION_KEY חסר — לא ניתן להצפין/לפענח פרטי ספק תשלום.",
        );
      }
      if (isProd && !isSet("PAYMENT_WEBHOOK_SECRET")) {
        errors.push(
          "PAYMENT_WEBHOOK_SECRET חסר — Webhook התשלומים יידחה (403) בפרודקשן עבור ספק אמיתי.",
        );
      }
    }
  }

  return { errors, warnings };
}
