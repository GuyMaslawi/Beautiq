import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

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
vi.mock("@/server/auth/session", () => ({
  requireTenant: vi.fn(async () => ({ businessId: BUSINESS_A })),
}));

import {
  saveWeeklyAvailabilityAction,
  addExceptionAction,
  deleteExceptionAction,
} from "@/server/availability/actions";
import {
  getWeeklyRules,
  getAvailabilityExceptions,
  hasAvailabilityRule,
} from "@/server/availability/queries";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const tenant = { businessId: BUSINESS_A };

beforeEach(() => resetPrismaMock(prisma));

// ---------------------------------------------------------------------------
// saveWeeklyAvailabilityAction
// ---------------------------------------------------------------------------

describe("saveWeeklyAvailabilityAction", () => {
  // Build a valid form: one open day (Sunday 09:00–17:00).
  function openSundayForm(): FormData {
    const fd = new FormData();
    for (let i = 0; i < 7; i++) {
      fd.set(`day_${i}_open`, i === 0 ? "true" : "false");
      fd.set(`day_${i}_start`, "09:00");
      fd.set(`day_${i}_end`, "17:00");
    }
    return fd;
  }

  it("returns day errors on invalid input without writing", async () => {
    const fd = new FormData();
    fd.set("day_0_open", "true");
    fd.set("day_0_start", "18:00");
    fd.set("day_0_end", "09:00"); // end before start -> invalid
    const res = await saveWeeklyAvailabilityAction({}, fd);
    expect(res.dayErrors).toBeTruthy();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("atomically deletes existing rules and recreates open days scoped to the business", async () => {
    prisma.availabilityRule.deleteMany.mockResolvedValue({ count: 7 });
    prisma.availabilityRule.createMany.mockResolvedValue({ count: 1 });

    const res = await saveWeeklyAvailabilityAction({}, openSundayForm());
    expect(res.success).toBe(true);

    expect(prisma.availabilityRule.deleteMany).toHaveBeenCalledWith({
      where: { businessId: BUSINESS_A },
    });
    expect(prisma.availabilityRule.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          businessId: BUSINESS_A,
          weekday: 0,
          startMinutes: 540,
          endMinutes: 1020,
          isActive: true,
        }),
      ],
    });
  });

  it("deletes rules but skips createMany when all days are closed", async () => {
    prisma.availabilityRule.deleteMany.mockResolvedValue({ count: 7 });
    const allClosed = formData({});
    for (let i = 0; i < 7; i++) allClosed.set(`day_${i}_open`, "false");

    const res = await saveWeeklyAvailabilityAction({}, allClosed);
    expect(res.success).toBe(true);
    expect(prisma.availabilityRule.deleteMany).toHaveBeenCalled();
    expect(prisma.availabilityRule.createMany).not.toHaveBeenCalled();
  });

  it("returns a generic error when the transaction throws", async () => {
    prisma.availabilityRule.deleteMany.mockRejectedValue(new Error("db boom"));
    const res = await saveWeeklyAvailabilityAction({}, openSundayForm());
    expect(res.formError).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// addExceptionAction
// ---------------------------------------------------------------------------

describe("addExceptionAction", () => {
  const closedException = {
    date: "2099-12-25",
    type: "closed",
    startTime: "",
    endTime: "",
    reason: "חופשה",
  };

  it("returns field errors on invalid input without writing", async () => {
    const res = await addExceptionAction({}, formData({ date: "", type: "" }));
    expect(res.errors).toBeTruthy();
    expect(prisma.availabilityException.create).not.toHaveBeenCalled();
  });

  it("creates a 'closed' exception scoped to the business", async () => {
    prisma.availabilityException.create.mockResolvedValue({ id: "exc_1" });
    const res = await addExceptionAction({}, formData(closedException));
    expect(res.success).toBe(true);
    expect(prisma.availabilityException.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: BUSINESS_A,
          type: "closed",
        }),
      }),
    );
  });

  it("maps a P2002 unique violation to a 'date taken' field error", async () => {
    prisma.availabilityException.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "5",
      }),
    );
    const res = await addExceptionAction({}, formData(closedException));
    expect(res.errors?.date).toBeTruthy();
    expect(res.values).toBeTruthy();
  });

  it("returns a generic error on other DB failures", async () => {
    prisma.availabilityException.create.mockRejectedValue(new Error("boom"));
    const res = await addExceptionAction({}, formData(closedException));
    expect(res.formError).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// deleteExceptionAction — scoped deleteMany prevents cross-tenant deletion.
// ---------------------------------------------------------------------------

describe("deleteExceptionAction", () => {
  it("deletes scoped by id + businessId", async () => {
    prisma.availabilityException.deleteMany.mockResolvedValue({ count: 1 });
    await deleteExceptionAction("exc_1");
    expect(prisma.availabilityException.deleteMany).toHaveBeenCalledWith({
      where: { id: "exc_1", businessId: BUSINESS_A },
    });
  });
});

// ---------------------------------------------------------------------------
// queries
// ---------------------------------------------------------------------------

describe("availability queries", () => {
  it("getWeeklyRules scopes by businessId and isActive", async () => {
    prisma.availabilityRule.findMany.mockResolvedValue([]);
    await getWeeklyRules(tenant);
    expect(prisma.availabilityRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: BUSINESS_A, isActive: true },
      }),
    );
  });

  it("getAvailabilityExceptions scopes by businessId", async () => {
    prisma.availabilityException.findMany.mockResolvedValue([]);
    await getAvailabilityExceptions(tenant);
    expect(prisma.availabilityException.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: BUSINESS_A } }),
    );
  });

  it("hasAvailabilityRule scopes the count and returns boolean", async () => {
    prisma.availabilityRule.count.mockResolvedValue(2);
    expect(await hasAvailabilityRule(tenant)).toBe(true);
    expect(prisma.availabilityRule.count).toHaveBeenCalledWith({
      where: { businessId: BUSINESS_A, isActive: true },
    });

    prisma.availabilityRule.count.mockResolvedValue(0);
    expect(await hasAvailabilityRule(tenant)).toBe(false);
  });
});
