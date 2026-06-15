import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

import { getPublicBookingSuccess } from "@/server/payments/booking-success";

/** A DB record shaped exactly like the query's `select`. */
function paymentRecord(
  status: string,
  slug = "studio-yofi",
  overrides: Record<string, unknown> = {},
) {
  return {
    status,
    business: { slug, name: "סטודיו יופי", phone: "050-1234567" },
    booking: {
      // 2026-06-15 07:30 UTC → Israel summer (UTC+3) → 10:30
      startTime: new Date("2026-06-15T07:30:00Z"),
      durationMinutesSnapshot: 60,
      service: { name: "מניקור ג'ל" },
      client: { fullName: "נועה כהן", phone: "0509876543" },
    },
    ...overrides,
  };
}

beforeEach(() => resetPrismaMock(prisma));

describe("getPublicBookingSuccess", () => {
  it("returns a public-safe success state for a paid payment", async () => {
    prisma.bookingPayment.findUnique.mockResolvedValue(paymentRecord("paid"));

    const state = await getPublicBookingSuccess("studio-yofi", "bp_1");

    expect(state).not.toBeNull();
    expect(state).toMatchObject({
      businessName: "סטודיו יופי",
      businessPhone: "050-1234567",
      serviceName: "מניקור ג'ל",
      date: "2026-06-15",
      time: "10:30",
      durationMinutes: 60,
      customerName: "נועה כהן",
      customerPhone: "0509876543",
      payment: "paid",
    });
  });

  it("maps statuses to a safe payment view", async () => {
    for (const [status, view] of [
      ["paid", "paid"],
      ["pending", "pending"],
      ["payment_link_created", "pending"],
      ["failed", "failed"],
      ["cancelled", "failed"],
      ["expired", "failed"],
    ] as const) {
      prisma.bookingPayment.findUnique.mockResolvedValue(paymentRecord(status));
      const state = await getPublicBookingSuccess("studio-yofi", "bp_1");
      expect(state?.payment).toBe(view);
    }
  });

  it("a pending DB status is NOT reported as paid even when reached via success return", async () => {
    // The token in the URL is never proof — the view follows the DB record.
    prisma.bookingPayment.findUnique.mockResolvedValue(
      paymentRecord("payment_link_created"),
    );
    const state = await getPublicBookingSuccess("studio-yofi", "bp_1");
    expect(state?.payment).toBe("pending");
  });

  it("never exposes internal/admin fields", async () => {
    prisma.bookingPayment.findUnique.mockResolvedValue(paymentRecord("paid"));
    const state = await getPublicBookingSuccess("studio-yofi", "bp_1");
    const keys = Object.keys(state ?? {});
    for (const forbidden of [
      "businessId",
      "bookingId",
      "clientId",
      "id",
      "providerPayloadJson",
      "providerTransactionId",
      "notes",
      "provider",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("returns null for an unknown token", async () => {
    prisma.bookingPayment.findUnique.mockResolvedValue(null);
    const state = await getPublicBookingSuccess("studio-yofi", "missing");
    expect(state).toBeNull();
  });

  it("returns null for an empty token without hitting the DB", async () => {
    const state = await getPublicBookingSuccess("studio-yofi", "");
    expect(state).toBeNull();
    expect(prisma.bookingPayment.findUnique).not.toHaveBeenCalled();
  });

  it("refuses a token whose business slug does not match (multi-tenant safety)", async () => {
    // Token belongs to business A, but the request is for business B's page.
    prisma.bookingPayment.findUnique.mockResolvedValue(
      paymentRecord("paid", "other-studio"),
    );
    const state = await getPublicBookingSuccess("studio-yofi", "bp_1");
    expect(state).toBeNull();
  });
});
