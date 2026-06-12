/**
 * Review-request runner — per-business execution with full audit trail.
 *
 * Creates one AutomationRun per execution and one AutomationMessage per booking
 * so every attempt is visible in the message log and can be tracked over time.
 *
 * Called by:
 *  - /api/cron/review-request (bypassTiming=false, source="cron")
 *  - /api/admin/automation/review-now (bypassTiming=true, source="manual_admin")
 */

import { prisma } from "@/server/db/prisma";
import { getWhatsAppProviderForBusiness } from "@/server/whatsapp/resolver";
import { isValidIsraeliPhone } from "@/lib/phone";

const DEFAULT_REVIEW_BODY =
  "היי {שם הלקוח} ❤️\n\nנהנינו לארח אותך!\n\nנשמח אם תוכלי להשאיר ביקורת קצרה 🙏\n{קישור לביקורת}\n\n{שם העסק}";

function applyVariables(body: string, vars: Record<string, string>): string {
  return body.replace(/\{[^}]+\}/g, (m) => vars[m] ?? m);
}

function toWaNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? "972" + digits.slice(1) : digits;
}

export interface ReviewRunResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  runId?: string;
  alreadyRan?: boolean;
  error?: string;
}

export async function runReviewRequestForBusiness(params: {
  businessId: string;
  reviewLink?: string | null;
  messageTemplate?: string | null;
  sendHour: number;
  bypassTiming?: boolean;
  now?: Date;
}): Promise<ReviewRunResult> {
  const {
    businessId,
    reviewLink,
    messageTemplate,
    sendHour,
    bypassTiming = false,
    now = new Date(),
  } = params;

  // hoursAfter: how many hours after completion to send (default 24 for legacy records)
  const hoursAfter = sendHour >= 1 && sendHour <= 6 ? sendHour : 24;
  // ±4h window for 24h (flexible for irregular cron), ±1h for same-day options
  const windowHours = hoursAfter <= 6 ? 1 : 4;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true, slug: true },
  });
  if (!business) {
    return { success: false, sentCount: 0, failedCount: 0, skippedCount: 0, error: "Business not found" };
  }

  // Idempotency guard: skip if a run already completed in the last 60 min.
  // Not applied when admin bypasses timing (they explicitly want a fresh run).
  if (!bypassTiming) {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const existingRun = await prisma.automationRun.findFirst({
      where: {
        businessId,
        type: "review_request",
        startedAt: { gte: oneHourAgo },
        status: { in: ["running", "completed", "partial"] },
      },
    });
    if (existingRun) {
      console.log(
        `[review-request] skip businessId=${businessId} — run exists (${existingRun.id})`,
      );
      return { success: true, sentCount: 0, failedCount: 0, skippedCount: 0, runId: existingRun.id, alreadyRan: true };
    }
  }

  // When bypassing timing (admin), look back a wider window for completed bookings
  // so the admin can test even outside the normal delivery window.
  let windowStart: Date;
  let windowEnd: Date;

  if (bypassTiming) {
    // Admin: look for bookings completed within the last 7 days without a review request
    windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    windowEnd = now;
  } else {
    windowEnd = new Date(now.getTime() - (hoursAfter - windowHours) * 60 * 60 * 1000);
    windowStart = new Date(now.getTime() - (hoursAfter + windowHours) * 60 * 60 * 1000);
  }

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

  if (bookings.length === 0) {
    return { success: true, sentCount: 0, failedCount: 0, skippedCount: 0 };
  }

  // Resolve message body
  let body = DEFAULT_REVIEW_BODY;
  if (messageTemplate) {
    body = messageTemplate;
  } else {
    const customTpl = await prisma.messageTemplate.findUnique({
      where: { businessId_type: { businessId, type: "after_treatment" } },
      select: { body: true, isActive: true },
    });
    if (customTpl?.isActive && customTpl.body) body = customTpl.body;
  }

  const provider = await getWhatsAppProviderForBusiness(businessId);
  const defaultReviewLink = reviewLink ?? `beautiq.co/b/${business.slug}#reviews`;
  const source = bypassTiming ? "manual_admin" : "cron";

  // Create the run record
  const run = await prisma.automationRun.create({
    data: { businessId, type: "review_request", status: "running", eligibleCount: bookings.length },
  });

  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const booking of bookings) {
    const phone = booking.client.normalizedPhone;

    if (!isValidIsraeliPhone(phone)) {
      await prisma.automationMessage.create({
        data: {
          businessId,
          runId: run.id,
          clientId: booking.clientId,
          bookingId: booking.id,
          type: "review_request",
          phone: phone ?? "",
          messageText: "",
          status: "skipped",
          failureReason: "מספר טלפון לא תקין",
          source,
        },
      });
      skippedCount++;
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

    const msg = await prisma.automationMessage.create({
      data: {
        businessId,
        runId: run.id,
        clientId: booking.clientId,
        bookingId: booking.id,
        type: "review_request",
        phone,
        messageText,
        status: "queued",
        source,
      },
    });

    try {
      const result = await provider.send({
        businessId,
        toPhone: toWaNumber(phone),
        fallbackText: messageText,
        automationRunId: run.id,
        clientId: booking.clientId,
      });

      if (result.success || result.isMockSkip) {
        await prisma.$transaction([
          prisma.automationMessage.update({
            where: { id: msg.id },
            data: {
              status: "sent",
              sentAt: new Date(),
              providerMessageId: result.providerMessageId ?? undefined,
            },
          }),
          prisma.booking.update({
            where: { id: booking.id },
            data: { reviewRequestSentAt: new Date() },
          }),
        ]);
        sentCount++;
      } else {
        await prisma.automationMessage.update({
          where: { id: msg.id },
          data: {
            status: "failed",
            failedAt: new Date(),
            failureReason: result.failureReason ?? "שגיאה לא ידועה",
          },
        });
        failedCount++;
        console.warn(
          `[review-request] failed bookingId=${booking.id}: ${result.failureReason}`,
        );
      }
    } catch (err) {
      await prisma.automationMessage
        .update({
          where: { id: msg.id },
          data: { status: "failed", failedAt: new Date(), failureReason: String(err) },
        })
        .catch(() => {});
      failedCount++;
      console.error(`[review-request] error bookingId=${booking.id}:`, err);
    }
  }

  const finalStatus =
    sentCount > 0 && failedCount === 0
      ? "completed"
      : sentCount > 0
      ? "partial"
      : failedCount > 0
      ? "failed"
      : "completed";

  await prisma.automationRun.update({
    where: { id: run.id },
    data: { status: finalStatus, finishedAt: new Date(), sentCount, failedCount, skippedCount },
  });

  return { success: true, sentCount, failedCount, skippedCount, runId: run.id };
}
