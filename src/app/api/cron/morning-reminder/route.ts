import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getWhatsAppProviderForBusiness } from "@/server/whatsapp/resolver";
import { isValidIsraeliPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_REMINDER_BODY =
  "בוקר טוב {שם הלקוח} ☀️\n\nרק תזכורת קטנה שיש לך היום תור ב:\n\n🕒 {שעה}\n✨ {שירות}\n\nמחכות לראותך ❤️\n{שם העסק}";

function formatTime(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(d);
}

function applyVariables(body: string, vars: Record<string, string>): string {
  return body.replace(/\{[^}]+\}/g, (m) => vars[m] ?? m);
}

function toWaNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? "972" + digits.slice(1) : digits;
}

function getDateString(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const israelHour = parseInt(
    new Intl.DateTimeFormat("he-IL", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Jerusalem",
    }).format(now),
    10,
  );

  console.log(`[cron/morning-reminder] starting — israelHour=${israelHour}`);

  // Fetch all enabled settings (filter by timing mode below)
  const allEnabled = await prisma.automationSetting.findMany({
    where: { type: "morning_reminder", enabled: true },
    select: { businessId: true, sendHour: true, thresholdDays: true, messageTemplate: true },
  });

  // Determine which settings should fire this hour:
  // - sendHour >= 0 (fixed hour): fire only when sendHour matches current Israel hour
  // - sendHour < 0 (relative, e.g. -3 = 3 hours before): fire every hour, filter by appointment window
  const eligibleSettings = allEnabled.filter(({ sendHour }) =>
    sendHour >= 0 ? sendHour === israelHour : true,
  );

  let totalSent = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const { businessId, sendHour, thresholdDays } of eligibleSettings) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, timezone: true },
    });
    if (!business) continue;

    const tz = business.timezone ?? "Asia/Jerusalem";

    let startWindow: Date;
    let endWindow: Date;

    if (sendHour < 0) {
      // Relative mode: find bookings starting in abs(sendHour) hours ± 30 minutes
      const hoursAhead = Math.abs(sendHour);
      const target = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
      startWindow = new Date(target.getTime() - 30 * 60 * 1000);
      endWindow = new Date(target.getTime() + 30 * 60 * 1000);
    } else if (thresholdDays === 1) {
      // Evening-before mode: send reminders for tomorrow's bookings
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowStr = getDateString(tomorrow, tz);
      startWindow = new Date(`${tomorrowStr}T00:00:00`);
      endWindow = new Date(`${tomorrowStr}T23:59:59`);
    } else {
      // Same-day mode (morning of appointment): send for today's bookings
      const todayStr = getDateString(now, tz);
      startWindow = new Date(`${todayStr}T00:00:00`);
      endWindow = new Date(`${todayStr}T23:59:59`);
    }

    const bookings = await prisma.booking.findMany({
      where: {
        businessId,
        status: { in: ["pending", "approved"] },
        reminderSentAt: null,
        startTime: { gte: startWindow, lte: endWindow },
      },
      include: {
        client: { select: { fullName: true, normalizedPhone: true } },
        service: { select: { name: true } },
      },
    });

    // Resolve message body
    let body = DEFAULT_REMINDER_BODY;
    const customTpl = await prisma.messageTemplate.findUnique({
      where: { businessId_type: { businessId, type: "booking_reminder" } },
      select: { body: true, isActive: true },
    });
    if (customTpl?.isActive && customTpl.body) body = customTpl.body;

    const provider = await getWhatsAppProviderForBusiness(businessId);

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
        "{שעה}": formatTime(booking.startTime, tz),
        "{clientName}": booking.client.fullName,
        "{businessName}": business.name,
        "{serviceName}": booking.service.name,
        "{bookingTime}": formatTime(booking.startTime, tz),
      };

      const messageText = applyVariables(body, vars);

      try {
        const result = await provider.send({
          businessId,
          toPhone: toWaNumber(phone),
          fallbackText: messageText,
          automationRunId: `reminder-${booking.id}`,
          clientId: booking.clientId,
        });

        if (result.success || result.isMockSkip) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { reminderSentAt: new Date() },
          });
          totalSent++;
        } else {
          totalFailed++;
          console.warn(`[cron/morning-reminder] failed bookingId=${booking.id}: ${result.failureReason}`);
        }
      } catch (err) {
        totalFailed++;
        console.error(`[cron/morning-reminder] error bookingId=${booking.id}:`, err);
      }
    }
  }

  console.log(`[cron/morning-reminder] done — sent=${totalSent} skipped=${totalSkipped} failed=${totalFailed}`);
  return NextResponse.json({ sent: totalSent, skipped: totalSkipped, failed: totalFailed });
}
