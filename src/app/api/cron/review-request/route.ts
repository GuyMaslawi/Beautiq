import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";
import { isValidIsraeliPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_REVIEW_BODY =
  "היי {שם הלקוח} ❤️\n\nנהנינו לארח אותך!\n\nנשמח אם תוכלי להשאיר ביקורת קצרה 🙏\n{קישור לביקורת}\n\n{שם העסק}";

function applyVariables(body: string, vars: Record<string, string>): string {
  return body.replace(/\{[^}]+\}/g, (m) => vars[m] ?? m);
}

function toWaNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? "972" + digits.slice(1) : digits;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[cron/review-request] starting");

  // Find all enabled review_request automations
  const eligibleSettings = await prisma.automationSetting.findMany({
    where: { type: "review_request", enabled: true },
    select: { businessId: true, offerValue: true, messageTemplate: true, sendHour: true },
  });

  let totalSent = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  const now = new Date();

  for (const setting of eligibleSettings) {
    const { businessId, offerValue: reviewLink, messageTemplate: settingTemplate, sendHour } = setting;

    // hoursAfter: how many hours after completion to send (default 24 for legacy records with sendHour=10)
    const hoursAfter = sendHour >= 1 && sendHour <= 6 ? sendHour : 24;
    // Use a ±4h window for 24h (flexible for irregular cron), ±1h for same-day options
    const windowHours = hoursAfter <= 6 ? 1 : 4;
    const windowEnd = new Date(now.getTime() - (hoursAfter - windowHours) * 60 * 60 * 1000);
    const windowStart = new Date(now.getTime() - (hoursAfter + windowHours) * 60 * 60 * 1000);

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, slug: true },
    });
    if (!business) continue;

    // Completed bookings in the target time window without a review request sent
    const bookings = await prisma.booking.findMany({
      where: {
        businessId,
        status: "completed",
        reviewRequestSentAt: null,
        completedAt: { gte: windowStart, lte: windowEnd },
      },
      include: {
        client: { select: { fullName: true, normalizedPhone: true } },
        service: { select: { name: true } },
      },
    });

    // Resolve message body
    let body = DEFAULT_REVIEW_BODY;
    if (settingTemplate) {
      body = settingTemplate;
    } else {
      const customTpl = await prisma.messageTemplate.findUnique({
        where: { businessId_type: { businessId, type: "after_treatment" } },
        select: { body: true, isActive: true },
      });
      if (customTpl?.isActive && customTpl.body) body = customTpl.body;
    }

    const provider = getWhatsAppProvider();

    // Default review link: the business's public page reputation section
    const defaultReviewLink = reviewLink ?? `beautiq.co/b/${business.slug}#reviews`;

    for (const booking of bookings) {
      const phone = booking.client.normalizedPhone;
      if (!isValidIsraeliPhone(phone)) {
        totalSkipped++;
        continue;
      }

      const vars: Record<string, string> = {
        "{שם הלקוח}": booking.client.fullName,
        "{שם הלקוחה}": booking.client.fullName,
        "{שם העסק}": business.name,
        "{שירות}": booking.service.name,
        "{קישור לביקורת}": defaultReviewLink,
        "{clientName}": booking.client.fullName,
        "{businessName}": business.name,
        "{serviceName}": booking.service.name,
        "{review_link}": defaultReviewLink,
      };

      const messageText = applyVariables(body, vars);

      try {
        const result = await provider.send({
          businessId,
          toPhone: toWaNumber(phone),
          fallbackText: messageText,
          automationRunId: `review-${booking.id}`,
          clientId: booking.clientId,
        });

        if (result.success || result.isMockSkip) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { reviewRequestSentAt: new Date() },
          });
          totalSent++;
        } else {
          totalFailed++;
          console.warn(`[cron/review-request] failed bookingId=${booking.id}: ${result.failureReason}`);
        }
      } catch (err) {
        totalFailed++;
        console.error(`[cron/review-request] error bookingId=${booking.id}:`, err);
      }
    }
  }

  console.log(`[cron/review-request] done — sent=${totalSent} skipped=${totalSkipped} failed=${totalFailed}`);
  return NextResponse.json({ sent: totalSent, skipped: totalSkipped, failed: totalFailed });
}
