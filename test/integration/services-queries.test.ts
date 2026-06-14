import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, makeService } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

import {
  getServices,
  getService,
  hasActiveService,
} from "@/server/services/queries";

const tenant = { businessId: BUSINESS_A };

beforeEach(() => resetPrismaMock(prisma));

describe("services queries — tenant scoping", () => {
  it("getServices filters by businessId", async () => {
    prisma.service.findMany.mockResolvedValue([makeService()]);
    await getServices(tenant);
    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: BUSINESS_A },
      }),
    );
  });

  it("getService uses a scoped findFirst (id + businessId)", async () => {
    prisma.service.findFirst.mockResolvedValue(makeService({ id: "svc_1" }));
    await getService(tenant, "svc_1");
    expect(prisma.service.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "svc_1", businessId: BUSINESS_A }),
      }),
    );
  });

  it("getService returns null when the scoped query finds nothing (cross-tenant id)", async () => {
    prisma.service.findFirst.mockResolvedValue(null);
    const res = await getService(tenant, "svc_other_business");
    expect(res).toBeNull();
  });

  it("hasActiveService counts only active services in the business", async () => {
    prisma.service.count.mockResolvedValue(2);
    const res = await hasActiveService(tenant);
    expect(res).toBe(true);
    expect(prisma.service.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: BUSINESS_A, isActive: true },
      }),
    );
  });

  it("hasActiveService returns false when count is zero", async () => {
    prisma.service.count.mockResolvedValue(0);
    expect(await hasActiveService(tenant)).toBe(false);
  });
});
