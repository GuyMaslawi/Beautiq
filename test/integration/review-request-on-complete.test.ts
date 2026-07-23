import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * sendThankYouForCompletedBooking — the immediate thank-you/review message sent
 * when the owner marks a booking as completed. Asserts it:
 *   - respects the review_request toggle (disabled → nothing sent)
 *   - targets the single booking and stamps source="auto_complete" when enabled
 *   - never throws into the caller (best-effort)
 */

const findUnique = vi.fn();
vi.mock("@/server/db/prisma", () => ({
  prisma: { automationSetting: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));

const runReviewRequestForBusiness = vi.fn((...args: unknown[]) => {
  void args; // accepts the runner's args; assertions use toHaveBeenCalledWith
  return Promise.resolve({
    success: true,
    sentCount: 1,
    failedCount: 0,
    skippedCount: 0,
  });
});
vi.mock("@/server/review-request/runner", () => ({
  runReviewRequestForBusiness: (...a: unknown[]) => runReviewRequestForBusiness(...a),
}));

import { sendThankYouForCompletedBooking } from "@/server/review-request/on-complete";

const BUSINESS = "biz_1";
const BOOKING = "bkg_1";

beforeEach(() => {
  findUnique.mockReset();
  runReviewRequestForBusiness.mockClear();
});

describe("sendThankYouForCompletedBooking", () => {
  it("sends nothing when the review_request automation is disabled", async () => {
    findUnique.mockResolvedValue({ enabled: false });
    await sendThankYouForCompletedBooking({ businessId: BUSINESS, bookingId: BOOKING });
    expect(runReviewRequestForBusiness).not.toHaveBeenCalled();
  });

  it("sends nothing when there is no setting at all", async () => {
    findUnique.mockResolvedValue(null);
    await sendThankYouForCompletedBooking({ businessId: BUSINESS, bookingId: BOOKING });
    expect(runReviewRequestForBusiness).not.toHaveBeenCalled();
  });

  it("targets the single booking with source=auto_complete when enabled", async () => {
    findUnique.mockResolvedValue({
      enabled: true,
      offerValue: "https://example.com/review",
      messageTemplate: null,
      sendHour: 24,
      requireOptIn: true,
      templateName: "review_request_he",
      templateLanguage: "he",
    });
    await sendThankYouForCompletedBooking({ businessId: BUSINESS, bookingId: BOOKING });
    expect(runReviewRequestForBusiness).toHaveBeenCalledTimes(1);
    expect(runReviewRequestForBusiness).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: BUSINESS,
        bookingId: BOOKING,
        source: "auto_complete",
        templateName: "review_request_he",
      }),
    );
  });

  it("never throws when the runner errors (best-effort)", async () => {
    findUnique.mockResolvedValue({ enabled: true, sendHour: 24 });
    runReviewRequestForBusiness.mockRejectedValueOnce(new Error("provider down"));
    await expect(
      sendThankYouForCompletedBooking({ businessId: BUSINESS, bookingId: BOOKING }),
    ).resolves.toBeUndefined();
  });

  it("never throws when the settings lookup errors", async () => {
    findUnique.mockRejectedValueOnce(new Error("db down"));
    await expect(
      sendThankYouForCompletedBooking({ businessId: BUSINESS, bookingId: BOOKING }),
    ).resolves.toBeUndefined();
    expect(runReviewRequestForBusiness).not.toHaveBeenCalled();
  });
});
