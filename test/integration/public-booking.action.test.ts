import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { makeBusiness, makeService, makeClient, BUSINESS_A, BUSINESS_B } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  // store on globalThis so the test can reach the same instance
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: () => "203.0.113.1" })),
}));

// Rate limiter is module-global in-memory state; mock it so it doesn't leak
// across tests. A dedicated test below flips it to the blocked state.
const checkRateLimit = vi.fn(() => true);
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => (checkRateLimit as (...a: unknown[]) => unknown)(...args),
  getClientIp: () => "203.0.113.1",
}));

const findOrCreateClient = vi.fn();
vi.mock("@/server/clients/find-or-create", () => ({
  findOrCreateClient: (...args: unknown[]) => findOrCreateClient(...args),
}));
const syncClientStats = vi.fn(async () => {});
vi.mock("@/server/clients/stats", () => ({
  syncClientStats: (...args: unknown[]) => (syncClientStats as (...a: unknown[]) => unknown)(...args),
}));
const hasOverlap = vi.fn(async () => false);
vi.mock("@/server/bookings/queries", () => ({
  hasOverlap: (...args: unknown[]) => (hasOverlap as (...a: unknown[]) => unknown)(...args),
}));
const sendBookingConfirmation = vi.fn(async () => {});
vi.mock("@/server/public-booking/send-confirmation", () => ({
  sendBookingConfirmation: (...args: unknown[]) => (sendBookingConfirmation as (...a: unknown[]) => unknown)(...args),
}));
const notifyOwnerOfNewBooking = vi.fn(async () => {});
vi.mock("@/server/public-booking/notify-owner", () => ({
  notifyOwnerOfNewBooking: (...args: unknown[]) => (notifyOwnerOfNewBooking as (...a: unknown[]) => unknown)(...args),
}));

import { submitPublicBookingAction } from "@/server/public-booking/actions";

const prisma = (globalThis as Record<string, unknown>).__prismaMock as ReturnType<
  typeof createPrismaMock
>;

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const validFields = {
  serviceId: "svc_1",
  clientName: "דנה",
  phone: "0501234567",
  date: "2099-07-01",
  requestedTime: "10:00",
  note: "",
};

beforeEach(() => {
  resetPrismaMock(prisma);
  findOrCreateClient.mockReset().mockResolvedValue(makeClient({ id: "cli_1" }));
  syncClientStats.mockReset();
  hasOverlap.mockReset().mockResolvedValue(false);
  sendBookingConfirmation.mockReset();
  notifyOwnerOfNewBooking.mockReset();
  checkRateLimit.mockReset().mockReturnValue(true);
});

describe("submitPublicBookingAction — validation & tenant safety", () => {
  it("blocks the request when the rate limit is exceeded", async () => {
    checkRateLimit.mockReturnValue(false);
    const res = await submitPublicBookingAction("studio-yofi", {}, formData(validFields));
    expect(res.formError).toBeTruthy();
    expect(prisma.business.findUnique).not.toHaveBeenCalled();
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it("returns field errors on invalid input without touching the DB", async () => {
    const res = await submitPublicBookingAction("studio-yofi", {}, formData({}));
    expect(res.errors).toBeTruthy();
    expect(prisma.business.findUnique).not.toHaveBeenCalled();
  });

  it("derives businessId from the slug, never from client input", async () => {
    prisma.business.findUnique.mockResolvedValue(makeBusiness({ id: BUSINESS_A }));
    prisma.service.findFirst.mockResolvedValue(makeService({ id: "svc_1", businessId: BUSINESS_A }));
    prisma.booking.create.mockResolvedValue({ id: "bkg_1" });

    // Attacker tries to inject a foreign businessId via the form
    await submitPublicBookingAction(
      "studio-yofi",
      {},
      formData({ ...validFields, businessId: BUSINESS_B }),
    );

    expect(prisma.business.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "studio-yofi" } }),
    );
    // Service lookup is scoped to the slug-derived business, not the injected one
    expect(prisma.service.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ businessId: BUSINESS_A, isActive: true }),
      }),
    );
    // The created booking carries the slug-derived businessId
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ businessId: BUSINESS_A }),
      }),
    );
  });

  it("returns a generic error when the slug does not resolve to a business", async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    const res = await submitPublicBookingAction("ghost", {}, formData(validFields));
    expect(res.formError).toBeTruthy();
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it("rejects a service that does not belong to the business (cross-tenant id)", async () => {
    prisma.business.findUnique.mockResolvedValue(makeBusiness({ id: BUSINESS_A }));
    prisma.service.findFirst.mockResolvedValue(null); // scoped query finds nothing
    const res = await submitPublicBookingAction("studio-yofi", {}, formData(validFields));
    expect(res.errors?.serviceId).toBeTruthy();
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it("rejects a booking in the past", async () => {
    prisma.business.findUnique.mockResolvedValue(makeBusiness({ id: BUSINESS_A }));
    prisma.service.findFirst.mockResolvedValue(makeService({ id: "svc_1" }));
    const res = await submitPublicBookingAction(
      "studio-yofi",
      {},
      formData({ ...validFields, date: "2000-01-01" }),
    );
    expect(res.errors?.date).toBeTruthy();
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it("rejects overlapping bookings", async () => {
    prisma.business.findUnique.mockResolvedValue(makeBusiness({ id: BUSINESS_A }));
    prisma.service.findFirst.mockResolvedValue(makeService({ id: "svc_1" }));
    hasOverlap.mockResolvedValue(true);
    const res = await submitPublicBookingAction("studio-yofi", {}, formData(validFields));
    expect(res.errors?.date).toBeTruthy();
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it("creates a pending public booking on success (no deposit fields)", async () => {
    prisma.business.findUnique.mockResolvedValue(makeBusiness({ id: BUSINESS_A }));
    prisma.service.findFirst.mockResolvedValue(makeService({ id: "svc_1" }));
    prisma.booking.create.mockResolvedValue({ id: "bkg_1" });

    const res = await submitPublicBookingAction("studio-yofi", {}, formData(validFields));
    expect(res.success).toBe(true);
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "pending", source: "public" }),
      }),
    );
    const arg = prisma.booking.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect("depositStatus" in arg.data).toBe(false);
    expect("depositAmountSnapshot" in arg.data).toBe(false);
    expect(syncClientStats).toHaveBeenCalled();

    // The business owner is notified automatically for the new pending booking,
    // scoped to the slug-derived business.
    expect(notifyOwnerOfNewBooking).toHaveBeenCalledWith({
      bookingId: "bkg_1",
      businessId: BUSINESS_A,
    });
  });

  it("returns a generic error (not a stack trace) when booking creation throws", async () => {
    prisma.business.findUnique.mockResolvedValue(makeBusiness({ id: BUSINESS_A }));
    prisma.service.findFirst.mockResolvedValue(makeService({ id: "svc_1" }));
    prisma.booking.create.mockRejectedValue(new Error("db down with secret details"));
    const res = await submitPublicBookingAction("studio-yofi", {}, formData(validFields));
    expect(res.formError).toBeTruthy();
    expect(res.formError).not.toContain("secret");
  });
});

describe("submitPublicReviewAction", () => {
  it("requires name and review text", async () => {
    const { submitPublicReviewAction } = await import("@/server/public-booking/actions");
    const res = await submitPublicReviewAction("studio-yofi", {}, formData({}));
    expect(res.errors).toBeTruthy();
    expect(prisma.clientReview.create).not.toHaveBeenCalled();
  });

  it("creates an approved review scoped to the slug business", async () => {
    const { submitPublicReviewAction } = await import("@/server/public-booking/actions");
    prisma.business.findUnique.mockResolvedValue({ id: BUSINESS_A });
    prisma.clientReview.create.mockResolvedValue({ id: "rev_1" });
    const res = await submitPublicReviewAction(
      "studio-yofi",
      {},
      formData({ clientName: "דנה", reviewText: "מעולה", rating: "5" }),
    );
    expect(res.success).toBe(true);
    expect(prisma.clientReview.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ businessId: BUSINESS_A, isApproved: true }),
      }),
    );
  });

  it("clamps an out-of-range rating into [1,5]", async () => {
    const { submitPublicReviewAction } = await import("@/server/public-booking/actions");
    prisma.business.findUnique.mockResolvedValue({ id: BUSINESS_A });
    prisma.clientReview.create.mockResolvedValue({ id: "rev_1" });
    await submitPublicReviewAction(
      "studio-yofi",
      {},
      formData({ clientName: "דנה", reviewText: "x", rating: "99" }),
    );
    expect(prisma.clientReview.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rating: 5 }) }),
    );
  });
});
