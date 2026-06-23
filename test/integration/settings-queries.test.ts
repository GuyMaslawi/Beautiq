import { describe, it, expect, vi, beforeEach } from "vitest";
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

import {
  getBusinessSettings,
  getSelectedCategoryIds,
  getAllBusinessCategories,
} from "@/server/settings/queries";

const tenant = { businessId: BUSINESS_A };

beforeEach(() => resetPrismaMock(prisma));

describe("getBusinessSettings", () => {
  it("fetches the business scoped by id", async () => {
    prisma.business.findUnique.mockResolvedValue({ id: BUSINESS_A, name: "עסק" });
    await getBusinessSettings(tenant);
    expect(prisma.business.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BUSINESS_A } }),
    );
  });
});

describe("getSelectedCategoryIds", () => {
  it("returns category ids scoped by businessId", async () => {
    prisma.businessCategoryOnBusiness.findMany.mockResolvedValue([
      { categoryId: "cat_1" },
      { categoryId: "cat_2" },
    ]);
    const res = await getSelectedCategoryIds(tenant);
    expect(res).toEqual(["cat_1", "cat_2"]);
    expect(prisma.businessCategoryOnBusiness.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: BUSINESS_A } }),
    );
  });
});

describe("getAllBusinessCategories", () => {
  it("lists the global categories (not tenant-scoped — shared reference data)", async () => {
    prisma.businessCategory.findMany.mockResolvedValue([
      { id: "cat_1", key: "nails", nameHe: "ציפורניים" },
    ]);
    const res = await getAllBusinessCategories();
    expect(res).toHaveLength(1);
    const arg = prisma.businessCategory.findMany.mock.calls[0][0] as {
      where?: unknown;
    };
    // Reference data — intentionally has no businessId filter.
    expect(arg.where).toBeUndefined();
  });
});
