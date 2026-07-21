/**
 * Health check endpoint — GET /api/health
 *
 * שכבה ציבורית (liveness): מחזירה 200 כשהשרת חי ומסד הנתונים נגיש,
 * או 503 כשמסד הנתונים לא מגיב. מתאים ל-uptime monitors וללוח בקרה.
 *
 * שכבה מפורטת (readiness): כאשר מצורף `Authorization: Bearer <CRON_SECRET>`
 * מוחזרת גם תמונת מצב של תצורת הפיצ'רים (WhatsApp/תשלומים) — בוליאנים בלבד,
 * ללא חשיפת ערכי סוד.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { checkEnv } from "@/lib/env";

// תמיד דינמי — בריאות נמדדת בזמן אמת, ללא cache.
export const dynamic = "force-dynamic";

function isSet(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

function isTrue(name: string): boolean {
  return (process.env[name] ?? "").trim().toLowerCase() === "true";
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const status = dbOk ? "ok" : "degraded";
  const body: Record<string, unknown> = {
    status,
    time: new Date().toISOString(),
    checks: { database: dbOk ? "ok" : "fail" },
  };

  // פרטים נוספים רק למי שמחזיק את CRON_SECRET (לוח בקרה תפעולי).
  if (isAuthorized(req)) {
    const env = checkEnv();
    body.config = {
      realWhatsAppSend: isTrue("ENABLE_REAL_WHATSAPP_SEND"),
      whatsAppTestMode: isTrue("WHATSAPP_TEST_MODE"),
      whatsAppEnvFallback: isTrue("WHATSAPP_USE_ENV_FALLBACK"),
      subscriptionsEnabled: isTrue("SUBSCRIPTIONS_ENABLED"),
      growCreateLinkWebhookSet: isSet("MAKE_GROW_CREATE_LINK_WEBHOOK_URL"),
      webhookAppSecretSet: isSet("META_WEBHOOK_APP_SECRET"),
      whatsAppEncryptionKeySet: isSet("WHATSAPP_CREDENTIALS_ENCRYPTION_KEY"),
    };
    body.env = { errors: env.errors, warnings: env.warnings };
  }

  return NextResponse.json(body, { status: dbOk ? 200 : 503 });
}
