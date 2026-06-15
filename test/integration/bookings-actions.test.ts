import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, makeService, makeClient } from "../helpers/factories";

// --- Shared mocked Prisma -------------------------------------------------
vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>).__prismaMock as ReturnType<
  typeof createPrismaMock
>;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

// requireTenant always resolves the current tenant from the authenticated user.
vi.mock("@/server/auth/session", () => ({
  requireTenant: vi.fn(async () => ({ businessId: BUSINESS_A })),
}));

// Side-effect collaborators — mocked so the action under test stays isolated.
const findOrCreateClient = vi.fn(() => undefined as unknown);
vi.mock("@/server/clients/find-or-create", () => ({
  findOrCreateClient: (...args: unknown[]) => (findOrCreateClient as (...a: unknown[]) => unknown)(...args),
}));
const syncClientStats = vi.fn(() => Promise.resolve());
vi.mock("@/server/clients/stats", () => ({
  syncClientStats: (...args: unknown[]) => (syncClientStats as (...a: unknown[]) => unknown)(...args),
}));
const hasOverlap = vi.fn(() => Promise.resolve(false));
const getBooking = vi.fn(() => Promise.resolve<unknown>(null));
vi.mock("@/server/bookings/queries", () => ({
  hasOverlap: (...args: unknown[]) => (hasOverlap as (...a: unknown[]) => unknown)(...args),
  getBooking: (...args: unknown[]) => (getBooking as (...a: unknown[]) => unknown)(...args),
}));

import {
  createBookingAction,
  updateBookingNotesAction,
  approveBookingAction,
  completeBookingAction,
  cancelBookingAction,
  noShowBookingAction,
  markLateCancellationFeePendingAction,
  markLateCancellationFeePaidAction,
} from "@/server/bookings/actions";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const validFields = {
  clientName: "דנה",
  phone: "0501234567",
  serviceId: "svc_1",
  date: "2099-07-01",
  startTime: "10:00",
  notes: "",
};

beforeEach(() => {
  resetPrismaMock(prisma);
  findOrCreateClient.mockReset().mockResolvedValue(makeClient({ id: "cli_1" }));
  syncClientStats.mockReset();
  hasOverlap.mockReset().mockResolvedValue(false);
  getBooking.mockReset().mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// createBookingAction
// ---------------------------------------------------------------------------

describe("createBookingAction", () => {
  it("returns field errors on invalid input without touching the DB", async () => {
    const res = await createBookingAction({}, formData({}));
    expect(res.errors).toBeTruthy();
    expect(prisma.service.findFirst).not.toHaveBeenCalled();
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it("looks up the service scoped to the tenant business and isActive", async () => {
    prisma.service.findFirst.mockResolvedValue(null);
    await createBookingAction({}, formData(validFields));
    expect(prisma.service.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "svc_1",
          businessId: BUSINESS_A,
          isActive: true,
        }),
      }),
    );
  });

  it("rejects a cross-tenant / inactive service (scoped findFirst returns null)", async () => {
    prisma.service.findFirst.mockResolvedValue(null);
    const res = await createBookingAction({}, formData(validFields));
    expect(res.errors?.serviceId).toBeTruthy();
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it("rejects a booking in the past", async () => {
    prisma.service.findFirst.mockResolvedValue(makeService({ id: "svc_1" }));
    const res = await createBookingAction(
      {},
      formData({ ...validFields, date: "2000-01-01" }),
    );
    expect(res.errors?.startTime).toBeTruthy();
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it("rejects an overlapping booking", async () => {
    prisma.service.findFirst.mockResolvedValue(makeService({ id: "svc_1" }));
    hasOverlap.mockResolvedValue(true);
    const res = await createBookingAction({}, formData(validFields));
    expect(res.errors?.startTime).toBeTruthy();
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it("creates an approved manual booking scoped to the tenant business before redirecting", async () => {
    prisma.service.findFirst.mockResolvedValue(
      makeService({ id: "svc_1", durationMinutes: 60 }),
    );
    prisma.booking.create.mockResolvedValue({ id: "bkg_1" });

    // The action redirects on success — wrap & swallow NEXT_REDIRECT.
    await expect(createBookingAction({}, formData(validFields))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: BUSINESS_A,
          clientId: "cli_1",
          serviceId: "svc_1",
          status: "approved",
          source: "manual",
        }),
      }),
    );
    expect(syncClientStats).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: BUSINESS_A, clientId: "cli_1" }),
    );
  });

  it("sets endTime = startTime + duration + buffers", async () => {
    prisma.service.findFirst.mockResolvedValue(
      makeService({
        id: "svc_1",
        durationMinutes: 60,
        bufferBeforeMinutes: 10,
        bufferAfterMinutes: 5,
      }),
    );
    prisma.booking.create.mockResolvedValue({ id: "bkg_1" });

    await expect(createBookingAction({}, formData(validFields))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    const arg = prisma.booking.create.mock.calls[0][0] as {
      data: { startTime: Date; endTime: Date };
    };
    const diffMinutes =
      (arg.data.endTime.getTime() - arg.data.startTime.getTime()) / 60000;
    expect(diffMinutes).toBe(75); // 60 + 10 + 5
  });

  it("never writes any deposit field when creating a booking", async () => {
    prisma.service.findFirst.mockResolvedValue(makeService({ id: "svc_1" }));
    prisma.booking.create.mockResolvedValue({ id: "bkg_1" });

    await expect(createBookingAction({}, formData(validFields))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    const arg = prisma.booking.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect("depositStatus" in arg.data).toBe(false);
    expect("depositAmountSnapshot" in arg.data).toBe(false);
  });

  it("returns a generic error (no leak) when booking creation throws", async () => {
    prisma.service.findFirst.mockResolvedValue(makeService({ id: "svc_1" }));
    prisma.booking.create.mockRejectedValue(new Error("db secret details"));
    const res = await createBookingAction({}, formData(validFields));
    expect(res.formError).toBeTruthy();
    expect(res.formError).not.toContain("secret");
    expect(syncClientStats).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateBookingNotesAction
// ---------------------------------------------------------------------------

describe("updateBookingNotesAction", () => {
  it("returns notFound when the booking is not in the tenant business", async () => {
    getBooking.mockResolvedValue(null);
    const res = await updateBookingNotesAction("bkg_x", {}, formData({ notes: "x" }));
    expect(res.formError).toBeTruthy();
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it("updates notes scoped by id + businessId, nulling empty notes", async () => {
    getBooking.mockResolvedValue({ id: "bkg_1" });
    prisma.booking.updateMany.mockResolvedValue({ count: 1 });
    const res = await updateBookingNotesAction("bkg_1", {}, formData({ notes: "  " }));
    expect(res.success).toBe(true);
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "bkg_1", businessId: BUSINESS_A },
      data: { notes: null },
    });
  });
});

// ---------------------------------------------------------------------------
// Status transitions — each must scope by id + businessId AND guard on status.
// The status guard simultaneously blocks invalid transitions and cross-tenant
// updates (updateMany matches 0 rows when either fails).
// ---------------------------------------------------------------------------

describe("status transition actions", () => {
  beforeEach(() => {
    prisma.booking.updateMany.mockResolvedValue({ count: 1 });
    prisma.booking.findFirst.mockResolvedValue({ clientId: "cli_1" });
  });

  it("approveBookingAction only transitions from pending", async () => {
    await approveBookingAction("bkg_1");
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "bkg_1", businessId: BUSINESS_A, status: "pending" },
      data: { status: "approved" },
    });
  });

  it("completeBookingAction only transitions from pending/approved and syncs stats", async () => {
    await completeBookingAction("bkg_1");
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "bkg_1",
          businessId: BUSINESS_A,
          status: { in: ["pending", "approved"] },
        },
        data: expect.objectContaining({ status: "completed" }),
      }),
    );
    expect(syncClientStats).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: BUSINESS_A, clientId: "cli_1" }),
    );
  });

  it("cancelBookingAction only transitions from pending/approved", async () => {
    await cancelBookingAction("bkg_1");
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "bkg_1",
          businessId: BUSINESS_A,
          status: { in: ["pending", "approved"] },
        },
        data: expect.objectContaining({ status: "cancelled" }),
      }),
    );
  });

  it("noShowBookingAction only transitions from pending/approved", async () => {
    await noShowBookingAction("bkg_1");
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "bkg_1",
          businessId: BUSINESS_A,
          status: { in: ["pending", "approved"] },
        },
        data: expect.objectContaining({ status: "no_show" }),
      }),
    );
  });

  it("does not sync stats when the booking lookup finds nothing (cross-tenant id)", async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    await completeBookingAction("bkg_x");
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bkg_x", businessId: BUSINESS_A },
      }),
    );
    expect(syncClientStats).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Late cancellation fee — only allowed from cancelled / no_show.
// ---------------------------------------------------------------------------

describe("late cancellation fee actions", () => {
  beforeEach(() => prisma.booking.updateMany.mockResolvedValue({ count: 1 }));

  it("markLateCancellationFeePendingAction scopes + guards on cancelled/no_show", async () => {
    await markLateCancellationFeePendingAction("bkg_1");
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: "bkg_1",
        businessId: BUSINESS_A,
        status: { in: ["cancelled", "no_show"] },
      },
      data: { lateCancellationFeeStatus: "pending" },
    });
  });

  it("markLateCancellationFeePaidAction scopes + guards on cancelled/no_show", async () => {
    await markLateCancellationFeePaidAction("bkg_1");
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: "bkg_1",
        businessId: BUSINESS_A,
        status: { in: ["cancelled", "no_show"] },
      },
      data: { lateCancellationFeeStatus: "paid" },
    });
  });
});
