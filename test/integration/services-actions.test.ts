import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, BUSINESS_B, makeService } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

// requireTenant always resolves to Business A in these tests.
const requireTenant = vi.fn(async () => ({ businessId: BUSINESS_A }));
vi.mock("@/server/auth/session", () => ({
  requireTenant: (...args: unknown[]) => (requireTenant as (...a: unknown[]) => unknown)(...args),
}));

import {
  createServiceAction,
  updateServiceAction,
  toggleServiceActiveAction,
} from "@/server/services/actions";

beforeEach(() => {
  resetPrismaMock(prisma);
  requireTenant.mockReset().mockResolvedValue({ businessId: BUSINESS_A });
});

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const validServiceFields = {
  name: "מניקור ג'ל",
  description: "תיאור",
  durationMinutes: "60",
  price: "150",
  requiresDeposit: "",
  depositAmount: "",
  bufferBeforeMinutes: "0",
  bufferAfterMinutes: "0",
  categoryKey: "nails",
  isActive: "true",
};

describe("createServiceAction", () => {
  it("creates the service scoped to the authenticated business and redirects", async () => {
    prisma.service.create.mockResolvedValue(makeService());
    await expect(
      createServiceAction({}, fd(validServiceFields)),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(prisma.service.create).toHaveBeenCalledTimes(1);
    expect(prisma.service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: BUSINESS_A,
          name: "מניקור ג'ל",
          durationMinutes: 60,
          isActive: true,
        }),
      }),
    );
  });

  it("never trusts a businessId injected via the form", async () => {
    prisma.service.create.mockResolvedValue(makeService());
    await expect(
      createServiceAction({}, fd({ ...validServiceFields, businessId: BUSINESS_B })),
    ).rejects.toThrow("NEXT_REDIRECT");

    const arg = prisma.service.create.mock.calls[0][0] as {
      data: { businessId: string };
    };
    expect(arg.data.businessId).toBe(BUSINESS_A);
  });

  it("returns field errors and does NOT write when required fields are missing", async () => {
    const res = await createServiceAction({}, fd({}));
    expect(res.errors).toBeTruthy();
    expect(res.values).toBeTruthy();
    expect(prisma.service.create).not.toHaveBeenCalled();
  });

  it("returns a validation error (not a DB write) when name is blank", async () => {
    const res = await createServiceAction(
      {},
      fd({ ...validServiceFields, name: "" }),
    );
    expect(res.errors?.name).toBeTruthy();
    expect(prisma.service.create).not.toHaveBeenCalled();
  });

  it("returns a safe generic error (no stack/secret) when the DB write throws", async () => {
    prisma.service.create.mockRejectedValue(
      new Error("db exploded with secret connection string"),
    );
    const res = await createServiceAction({}, fd(validServiceFields));
    expect(res.formError).toBeTruthy();
    expect(res.formError).not.toContain("secret");
    expect(res.values).toBeTruthy();
  });
});

describe("updateServiceAction", () => {
  it("loads the existing service scoped by tenant before updating", async () => {
    prisma.service.findFirst.mockResolvedValue(
      makeService({ id: "svc_1", businessId: BUSINESS_A }),
    );
    prisma.service.update.mockResolvedValue(makeService({ id: "svc_1" }));

    await expect(
      updateServiceAction("svc_1", {}, fd(validServiceFields)),
    ).rejects.toThrow("NEXT_REDIRECT");

    // getService -> findFirst scoped with businessId
    expect(prisma.service.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "svc_1", businessId: BUSINESS_A }),
      }),
    );
    expect(prisma.service.update).toHaveBeenCalledTimes(1);
  });

  it("rejects update when the service id belongs to another business (scoped lookup returns null) WITHOUT mutating", async () => {
    prisma.service.findFirst.mockResolvedValue(null); // cross-tenant id: scoped query finds nothing
    const res = await updateServiceAction("svc_other", {}, fd(validServiceFields));
    expect(res.formError).toBeTruthy();
    expect(prisma.service.update).not.toHaveBeenCalled();
  });

  it("returns validation errors before writing when fields are invalid", async () => {
    prisma.service.findFirst.mockResolvedValue(
      makeService({ id: "svc_1", businessId: BUSINESS_A }),
    );
    const res = await updateServiceAction(
      "svc_1",
      {},
      fd({ ...validServiceFields, durationMinutes: "abc" }),
    );
    expect(res.errors?.durationMinutes).toBeTruthy();
    expect(prisma.service.update).not.toHaveBeenCalled();
  });

  it("sets isActive=false when the checkbox value is absent", async () => {
    prisma.service.findFirst.mockResolvedValue(
      makeService({ id: "svc_1", businessId: BUSINESS_A }),
    );
    prisma.service.update.mockResolvedValue(makeService({ id: "svc_1" }));
    await expect(
      updateServiceAction("svc_1", {}, fd({ ...validServiceFields, isActive: "" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(prisma.service.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });

  it("returns a safe generic error when the update throws", async () => {
    prisma.service.findFirst.mockResolvedValue(
      makeService({ id: "svc_1", businessId: BUSINESS_A }),
    );
    prisma.service.update.mockRejectedValue(new Error("secret db error"));
    const res = await updateServiceAction("svc_1", {}, fd(validServiceFields));
    expect(res.formError).toBeTruthy();
    expect(res.formError).not.toContain("secret");
  });
});

describe("toggleServiceActiveAction", () => {
  it("scopes the updateMany by businessId (cannot touch another tenant's row)", async () => {
    prisma.service.updateMany.mockResolvedValue({ count: 1 });
    prisma.business.findUnique.mockResolvedValue({ slug: "studio-yofi" });

    const res = await toggleServiceActiveAction("svc_1", false);
    expect(res.success).toBe(true);
    expect(prisma.service.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "svc_1", businessId: BUSINESS_A },
        data: { isActive: false },
      }),
    );
  });

  it("returns success:false on error without throwing", async () => {
    prisma.service.updateMany.mockRejectedValue(new Error("boom"));
    const res = await toggleServiceActiveAction("svc_1", true);
    expect(res.success).toBe(false);
  });
});
