/**
 * Immediate thank-you / review message on booking completion.
 *
 * When the owner marks a booking as "completed" we send the after-treatment
 * thank-you message to that client right away — the ideal moment, just as she
 * leaves. This reuses the review-request runner scoped to the single booking, so
 * it shares all the safety guards (valid phone, unsubscribed, approved template
 * for real sends) and sets `reviewRequestSentAt` so the hourly cron never sends
 * a duplicate.
 *
 * Respects the owner's toggle: if the `review_request` automation is disabled for
 * the business, nothing is sent. Best-effort — never throws into the caller.
 */

import { prisma } from "@/server/db/prisma";
import { runReviewRequestForBusiness } from "./runner";

export async function sendThankYouForCompletedBooking(params: {
  businessId: string;
  bookingId: string;
}): Promise<void> {
  const { businessId, bookingId } = params;
  try {
    const setting = await prisma.automationSetting.findUnique({
      where: { businessId_type: { businessId, type: "review_request" } },
    });

    // Respect the owner's choice — the thank-you automation must be enabled.
    if (!setting?.enabled) return;

    await runReviewRequestForBusiness({
      businessId,
      bookingId,
      reviewLink: setting.offerValue,
      messageTemplate: setting.messageTemplate,
      sendHour: setting.sendHour,
      requireOptIn: setting.requireOptIn,
      templateName: setting.templateName,
      templateLanguage: setting.templateLanguage,
      source: "auto_complete",
    });
  } catch (err) {
    // Never block marking a booking complete because of a messaging hiccup.
    console.error(
      `[thank-you] failed to send on completion bookingId=${bookingId}:`,
      err,
    );
  }
}
