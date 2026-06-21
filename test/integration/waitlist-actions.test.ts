import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, BUSINESS_B } from "../helpers/factories";

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

const findOrCreateClient = vi.fn(async () => ({ id: "cli_1" }));
vi.mock("@/server/clients/find-or-create", () => ({
  findOrCreateClient: (...a: unknown[]) =>
    (findOrCreateClient as (...x: unknown[]) => unknown)(...a),
}));

import {
  createWaitlistEntryAction,
  setWaitlistStatusAction,
} from "@/server/waitlist/actions";

beforeEach(() => {
  resetPrismaMock(prisma);
  requireTenant.mockReset().mockResolvedValue({ businessId: BUSINESS_A });
  findOrCreateClient.mockReset().mockResolvedValue({ id: "cli_1" });
});

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const validFields = {
  clientName: "עדי כהן",
  phone: "050-1234567",
};

describe("createWaitlistEntryAction", () => {
  it("creates an entry scoped to the tenant and returns success+nonce", async () => {
    prisma.waitlistEntry.create.mockResolvedValue({ id: "wl_new" });
    const res = await createWaitlistEntryAction({}, fd(validFields));
    expect(res.success).toBe(true);
    expect(res.nonce).toBe("wl_new");
    expect(findOrCreateClient).toHaveBeenCalledWith(
      { businessId: BUSINESS_A },
      { fullName: "עדי כהן", phone: "050-1234567" },
    );
    expect(prisma.waitlistEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: BUSINESS_A,
          clientId: "cli_1",
          serviceId: null,
          status: "active",
        }),
      }),
    );
  });

  it("returns a name error and does NOT write when name is blank", async () => {
    const res = await createWaitlistEntryAction({}, fd({ ...validFields, clientName: "" }));
    expect(res.errors?.clientName).toBeTruthy();
    expect(res.values).toBeTruthy();
    expect(prisma.waitlistEntry.create).not.toHaveBeenCalled();
  });

  it("returns a phone error when the phone is invalid", async () => {
    const res = await createWaitlistEntryAction({}, fd({ ...validFields, phone: "abc" }));
    expect(res.errors?.phone).toBeTruthy();
    expect(prisma.waitlistEntry.create).not.toHaveBeenCalled();
  });

  it("verifies an optional serviceId belongs to the tenant before storing it", async () => {
    prisma.service.findFirst.mockResolvedValue({ id: "svc_1" });
    prisma.waitlistEntry.create.mockResolvedValue({ id: "wl_2" });
    await createWaitlistEntryAction({}, fd({ ...validFields, serviceId: "svc_1" }));
    expect(prisma.service.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "svc_1", businessId: BUSINESS_A },
      }),
    );
    const arg = prisma.waitlistEntry.create.mock.calls[0][0] as {
      data: { serviceId: string | null };
    };
    expect(arg.data.serviceId).toBe("svc_1");
  });

  it("drops a cross-tenant serviceId (scoped lookup returns null) storing null", async () => {
    prisma.service.findFirst.mockResolvedValue(null);
    prisma.waitlistEntry.create.mockResolvedValue({ id: "wl_3" });
    await createWaitlistEntryAction(
      {},
      fd({ ...validFields, serviceId: "svc_other" }),
    );
    const arg = prisma.waitlistEntry.create.mock.calls[0][0] as {
      data: { serviceId: string | null };
    };
    expect(arg.data.serviceId).toBeNull();
  });

  it("builds a preferred window only when a date is provided, with defaults", async () => {
    prisma.waitlistEntry.create.mockResolvedValue({ id: "wl_4" });
    await createWaitlistEntryAction(
      {},
      fd({ ...validFields, preferredDate: "2026-07-10", preferredFromTime: "10:00" }),
    );
    const arg = prisma.waitlistEntry.create.mock.calls[0][0] as {
      data: { preferredFrom: Date | null; preferredTo: Date | null };
    };
    expect(arg.data.preferredFrom).toBeInstanceOf(Date);
    expect(arg.data.preferredTo).toBeInstanceOf(Date);
  });

  it("stores no window when no preferred date is given", async () => {
    prisma.waitlistEntry.create.mockResolvedValue({ id: "wl_5" });
    await createWaitlistEntryAction({}, fd(validFields));
    const arg = prisma.waitlistEntry.create.mock.calls[0][0] as {
      data: { preferredFrom: Date | null; preferredTo: Date | null };
    };
    expect(arg.data.preferredFrom).toBeNull();
    expect(arg.data.preferredTo).toBeNull();
  });

  it("stores notes when given, null when empty", async () => {
    prisma.waitlistEntry.create.mockResolvedValue({ id: "wl_6" });
    await createWaitlistEntryAction({}, fd({ ...validFields, notes: "אחר הצהריים" }));
    const arg = prisma.waitlistEntry.create.mock.calls[0][0] as {
      data: { notes: string | null };
    };
    expect(arg.data.notes).toBe("אחר הצהריים");
  });

  it("returns a safe generic formError (no secret) when create throws", async () => {
    prisma.waitlistEntry.create.mockRejectedValue(
      new Error("db secret connection string"),
    );
    const res = await createWaitlistEntryAction({}, fd(validFields));
    expect(res.formError).toBeTruthy();
    expect(res.formError).not.toContain("secret");
    expect(res.values).toBeTruthy();
  });
});

describe("setWaitlistStatusAction", () => {
  it("updates status scoped by entry id + tenant businessId", async () => {
    prisma.waitlistEntry.updateMany.mockResolvedValue({ count: 1 });
    await setWaitlistStatusAction("wl_1", "booked");
    expect(prisma.waitlistEntry.updateMany).toHaveBeenCalledWith({
      where: { id: "wl_1", businessId: BUSINESS_A },
      data: { status: "booked" },
    });
  });

  it("uses the authenticated tenant, never a caller-controlled business", async () => {
    requireTenant.mockResolvedValue({ businessId: BUSINESS_B });
    prisma.waitlistEntry.updateMany.mockResolvedValue({ count: 0 });
    await setWaitlistStatusAction("wl_1", "cancelled");
    const arg = prisma.waitlistEntry.updateMany.mock.calls[0][0] as {
      where: { businessId: string };
    };
    expect(arg.where.businessId).toBe(BUSINESS_B);
  });
});
