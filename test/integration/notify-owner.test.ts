import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

// Prisma is mocked so the notifier runs without a database.
vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

// The email transport is mocked so we assert on dispatch content + result,
// without hitting any network.
const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email/send", () => ({
  sendEmail,
  isEmailConfigured: () => true,
}));

import { notifyOwnerOfNewBooking } from "@/server/public-booking/notify-owner";

const BOOKING_ID = "bkg_public_1";

function mockBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    status: "pending",
    startTime: new Date("2026-07-01T09:00:00Z"), // 12:00 Asia/Jerusalem (DST)
    ownerNotifiedAt: null,
    priceSnapshot: new Prisma.Decimal(150),
    client: { fullName: "נועה כהן", phone: "050-987-6543" },
    service: { name: "מניקור ג'ל" },
    business: {
      name: "סטודיו יופי",
      phone: "+972501234567",
      members: [{ user: { email: "owner@example.com", name: "בעלת העסק" } }],
    },
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock(prisma);
  sendEmail.mockReset().mockResolvedValue({ ok: true, id: "email_1" });
});

describe("notifyOwnerOfNewBooking — owner email", () => {
  it("loads the booking scoped by id AND businessId (multi-tenant safety)", async () => {
    prisma.booking.findFirst.mockResolvedValue(mockBooking());
    prisma.booking.update.mockResolvedValue({});

    await notifyOwnerOfNewBooking({ bookingId: BOOKING_ID, businessId: BUSINESS_A });

    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BOOKING_ID, businessId: BUSINESS_A },
      }),
    );
  });

  it("emails the owner with the full booking details and a management link", async () => {
    prisma.booking.findFirst.mockResolvedValue(mockBooking());
    prisma.booking.update.mockResolvedValue({});

    await notifyOwnerOfNewBooking({ bookingId: BOOKING_ID, businessId: BUSINESS_A });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.to).toBe("owner@example.com");
    expect(arg.subject).toBe("בקשת תור חדשה מ־Allura");

    // Body carries every required field.
    expect(arg.text).toContain("נועה כהן"); // customer name
    expect(arg.text).toContain("050-987-6543"); // customer phone
    expect(arg.text).toContain("מניקור ג'ל"); // service
    expect(arg.text).toContain("12:00"); // time (Asia/Jerusalem)
    expect(arg.text).toContain("₪150"); // price
    expect(arg.text).toContain("ממתין לאישור"); // status
    expect(arg.text).toContain("/bookings"); // management link
    expect(arg.text).toContain("בעלת העסק"); // owner greeting
  });

  it("marks ownerNotifiedAt after a successful send (idempotency guard)", async () => {
    prisma.booking.findFirst.mockResolvedValue(mockBooking());
    prisma.booking.update.mockResolvedValue({});

    await notifyOwnerOfNewBooking({ bookingId: BOOKING_ID, businessId: BUSINESS_A });

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BOOKING_ID },
        data: expect.objectContaining({ ownerNotifiedAt: expect.any(Date) }),
      }),
    );
  });

  it("does nothing when the booking was already notified (no duplicate email)", async () => {
    prisma.booking.findFirst.mockResolvedValue(
      mockBooking({ ownerNotifiedAt: new Date("2026-06-30T00:00:00Z") }),
    );

    await notifyOwnerOfNewBooking({ bookingId: BOOKING_ID, businessId: BUSINESS_A });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it("does NOT mark ownerNotifiedAt when email is skipped (unconfigured) — allows a later retry", async () => {
    sendEmail.mockResolvedValue({ ok: false, skipped: true, reason: "email_not_configured" });
    prisma.booking.findFirst.mockResolvedValue(mockBooking());

    await notifyOwnerOfNewBooking({ bookingId: BOOKING_ID, businessId: BUSINESS_A });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it("skips the email but never throws when no owner email is on file", async () => {
    prisma.booking.findFirst.mockResolvedValue(
      mockBooking({ business: { name: "סטודיו יופי", phone: null, members: [] } }),
    );

    await expect(
      notifyOwnerOfNewBooking({ bookingId: BOOKING_ID, businessId: BUSINESS_A }),
    ).resolves.toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it("never throws and skips when the booking is missing / cross-tenant", async () => {
    prisma.booking.findFirst.mockResolvedValue(null);

    await expect(
      notifyOwnerOfNewBooking({ bookingId: BOOKING_ID, businessId: BUSINESS_A }),
    ).resolves.toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("never throws if the email transport itself throws", async () => {
    sendEmail.mockRejectedValue(new Error("network down"));
    prisma.booking.findFirst.mockResolvedValue(mockBooking());

    await expect(
      notifyOwnerOfNewBooking({ bookingId: BOOKING_ID, businessId: BUSINESS_A }),
    ).resolves.toBeUndefined();
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });
});
