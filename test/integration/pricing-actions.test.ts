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
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireTenant = vi.fn(async () => ({ businessId: BUSINESS_A }));
vi.mock("@/server/auth/session", () => ({
  requireTenant: (...a: unknown[]) =>
    (requireTenant as (...x: unknown[]) => unknown)(...a),
}));

import { saveMarketRangeAction } from "@/server/pricing/actions";

beforeEach(() => {
  resetPrismaMock(prisma);
  requireTenant.mockReset().mockResolvedValue({ businessId: BUSINESS_A });
});

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("saveMarketRangeAction", () => {
  it("saves the range scoped by service id + tenant, converting to Decimal", async () => {
    prisma.service.updateMany.mockResolvedValue({ count: 1 });
    const res = await saveMarketRangeAction(
      "svc_1",
      {},
      fd({ marketMinPrice: "100", marketAveragePrice: "150", marketMaxPrice: "200" }),
    );
    expect(res.success).toBe(true);
    expect(prisma.service.updateMany).toHaveBeenCalledTimes(1);
    const arg = prisma.service.updateMany.mock.calls[0][0] as {
      where: { id: string; businessId: string };
      data: {
        marketMinPrice: Prisma.Decimal;
        marketAveragePrice: Prisma.Decimal;
        marketMaxPrice: Prisma.Decimal;
      };
    };
    expect(arg.where).toEqual({ id: "svc_1", businessId: BUSINESS_A });
    expect(arg.data.marketMinPrice).toBeInstanceOf(Prisma.Decimal);
    expect(Number(arg.data.marketMinPrice)).toBe(100);
    expect(Number(arg.data.marketAveragePrice)).toBe(150);
    expect(Number(arg.data.marketMaxPrice)).toBe(200);
  });

  it("stores nulls when all fields are blank", async () => {
    prisma.service.updateMany.mockResolvedValue({ count: 1 });
    const res = await saveMarketRangeAction("svc_1", {}, fd({}));
    expect(res.success).toBe(true);
    const arg = prisma.service.updateMany.mock.calls[0][0] as {
      data: { marketMinPrice: null; marketAveragePrice: null; marketMaxPrice: null };
    };
    expect(arg.data.marketMinPrice).toBeNull();
    expect(arg.data.marketAveragePrice).toBeNull();
    expect(arg.data.marketMaxPrice).toBeNull();
  });

  // Invalid input returns a field-level error and never writes to the DB.
  it("returns a field error for a negative min and does not write", async () => {
    prisma.service.updateMany.mockResolvedValue({ count: 1 });
    const res = await saveMarketRangeAction(
      "svc_1",
      {},
      fd({ marketMinPrice: "-5" }),
    );
    expect(res.fieldErrors?.min).toBeTruthy();
    expect(res.success).toBeFalsy();
    expect(prisma.service.updateMany).not.toHaveBeenCalled();
  });

  it("returns a field error for a non-numeric average and does not write", async () => {
    prisma.service.updateMany.mockResolvedValue({ count: 1 });
    const res = await saveMarketRangeAction(
      "svc_1",
      {},
      fd({ marketAveragePrice: "abc" }),
    );
    expect(res.fieldErrors?.avg).toBeTruthy();
    expect(res.success).toBeFalsy();
    expect(prisma.service.updateMany).not.toHaveBeenCalled();
  });

  it("returns a field error for an invalid (negative) max and does not write", async () => {
    prisma.service.updateMany.mockResolvedValue({ count: 1 });
    const res = await saveMarketRangeAction(
      "svc_1",
      {},
      fd({ marketMaxPrice: "-1" }),
    );
    expect(res.fieldErrors?.max).toBeTruthy();
    expect(res.success).toBeFalsy();
    expect(prisma.service.updateMany).not.toHaveBeenCalled();
  });

  it("reports field errors for several invalid fields at once", async () => {
    prisma.service.updateMany.mockResolvedValue({ count: 1 });
    const res = await saveMarketRangeAction(
      "svc_1",
      {},
      fd({ marketMinPrice: "abc", marketMaxPrice: "-2" }),
    );
    expect(res.fieldErrors?.min).toBeTruthy();
    expect(res.fieldErrors?.max).toBeTruthy();
    expect(prisma.service.updateMany).not.toHaveBeenCalled();
  });

  it("rejects when min > max (cross-field) without writing", async () => {
    const res = await saveMarketRangeAction(
      "svc_1",
      {},
      fd({ marketMinPrice: "300", marketMaxPrice: "100" }),
    );
    expect(res.formError).toBeTruthy();
    expect(prisma.service.updateMany).not.toHaveBeenCalled();
  });

  it("rejects when avg is below min", async () => {
    const res = await saveMarketRangeAction(
      "svc_1",
      {},
      fd({ marketMinPrice: "100", marketAveragePrice: "50" }),
    );
    expect(res.formError).toBeTruthy();
    expect(prisma.service.updateMany).not.toHaveBeenCalled();
  });

  it("rejects when avg is above max", async () => {
    const res = await saveMarketRangeAction(
      "svc_1",
      {},
      fd({ marketMaxPrice: "100", marketAveragePrice: "150" }),
    );
    expect(res.formError).toBeTruthy();
    expect(prisma.service.updateMany).not.toHaveBeenCalled();
  });

  it("accepts a valid avg inside the min/max range", async () => {
    prisma.service.updateMany.mockResolvedValue({ count: 1 });
    const res = await saveMarketRangeAction(
      "svc_1",
      {},
      fd({ marketMinPrice: "100", marketAveragePrice: "150", marketMaxPrice: "200" }),
    );
    expect(res.success).toBe(true);
  });

  it("returns a safe generic error (no secret) when the update throws", async () => {
    prisma.service.updateMany.mockRejectedValue(new Error("secret db string"));
    const res = await saveMarketRangeAction(
      "svc_1",
      {},
      fd({ marketMinPrice: "100" }),
    );
    expect(res.formError).toBeTruthy();
    expect(res.formError).not.toContain("secret");
  });
});
