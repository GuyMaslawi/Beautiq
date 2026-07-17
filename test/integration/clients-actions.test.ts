import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, BUSINESS_B, makeClient } from "../helpers/factories";

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
  requireTenant: (...args: unknown[]) => (requireTenant as (...a: unknown[]) => unknown)(...args),
}));

// getClientDetail is its own scoped query; mock it so updateClientNotesAction's
// existence check is controllable per-test.
const getClientDetail = vi.fn();
vi.mock("@/server/clients/queries", () => ({
  getClientDetail: (...args: unknown[]) => getClientDetail(...args),
}));

import {
  updateClientNotesAction,
  updateClientOptInAction,
  updateClientAction,
} from "@/server/clients/actions";

beforeEach(() => {
  resetPrismaMock(prisma);
  requireTenant.mockReset().mockResolvedValue({ businessId: BUSINESS_A });
  getClientDetail.mockReset();
});

function fd(fields: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, x));
    else f.set(k, v);
  }
  return f;
}

// ---------------------------------------------------------------------------
// updateClientNotesAction
// ---------------------------------------------------------------------------
describe("updateClientNotesAction", () => {
  it("verifies ownership via scoped getClientDetail, then writes scoped updateMany", async () => {
    getClientDetail.mockResolvedValue({ id: "cli_1" });
    prisma.client.updateMany.mockResolvedValue({ count: 1 });

    const res = await updateClientNotesAction("cli_1", {}, fd({ notes: "  הערה  " }));
    expect(res.success).toBe(true);
    expect(getClientDetail).toHaveBeenCalledWith(
      { businessId: BUSINESS_A },
      "cli_1",
    );
    expect(prisma.client.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cli_1", businessId: BUSINESS_A },
        data: { notes: "הערה" }, // trimmed
      }),
    );
  });

  it("stores null when notes are blank", async () => {
    getClientDetail.mockResolvedValue({ id: "cli_1" });
    prisma.client.updateMany.mockResolvedValue({ count: 1 });
    await updateClientNotesAction("cli_1", {}, fd({ notes: "   " }));
    expect(prisma.client.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { notes: null } }),
    );
  });

  it("returns not-found and does NOT write for a cross-tenant client id", async () => {
    getClientDetail.mockResolvedValue(null); // scoped lookup found nothing
    const res = await updateClientNotesAction("cli_other", {}, fd({ notes: "x" }));
    expect(res.formError).toBeTruthy();
    expect(prisma.client.updateMany).not.toHaveBeenCalled();
  });

  it("returns a safe generic error when the write throws", async () => {
    getClientDetail.mockResolvedValue({ id: "cli_1" });
    prisma.client.updateMany.mockRejectedValue(new Error("secret db crash"));
    const res = await updateClientNotesAction("cli_1", {}, fd({ notes: "x" }));
    expect(res.formError).toBeTruthy();
    expect(res.formError).not.toContain("secret");
  });
});

// ---------------------------------------------------------------------------
// updateClientOptInAction
// ---------------------------------------------------------------------------
describe("updateClientOptInAction", () => {
  it("updates opt-in and records provenance when newly granting WhatsApp consent", async () => {
    prisma.client.findUnique.mockResolvedValue({
      id: "cli_1",
      businessId: BUSINESS_A,
      whatsappOptIn: false, // was not opted in → provenance should be recorded
    });
    prisma.client.update.mockResolvedValue(makeClient({ id: "cli_1" }));

    const res = await updateClientOptInAction(
      "cli_1",
      {},
      fd({ whatsappOptIn: "true", marketingOptIn: "true" }),
    );
    expect(res.success).toBe(true);
    expect(prisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cli_1" },
        data: expect.objectContaining({
          whatsappOptIn: true,
          marketingOptIn: true,
          whatsappOptInSource: "manual_owner",
          whatsappOptInAt: expect.any(Date),
        }),
      }),
    );
  });

  it("sets opt-in false when checkbox values are absent", async () => {
    prisma.client.findUnique.mockResolvedValue({
      id: "cli_1",
      businessId: BUSINESS_A,
    });
    prisma.client.update.mockResolvedValue(makeClient({ id: "cli_1" }));
    await updateClientOptInAction("cli_1", {}, fd({}));
    expect(prisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { whatsappOptIn: false, marketingOptIn: false },
      }),
    );
  });

  it("rejects when the client belongs to another business WITHOUT mutating", async () => {
    prisma.client.findUnique.mockResolvedValue({
      id: "cli_1",
      businessId: BUSINESS_B, // foreign tenant
    });
    const res = await updateClientOptInAction(
      "cli_1",
      {},
      fd({ whatsappOptIn: "true" }),
    );
    expect(res.error).toBeTruthy();
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it("rejects when the client does not exist", async () => {
    prisma.client.findUnique.mockResolvedValue(null);
    const res = await updateClientOptInAction("ghost", {}, fd({}));
    expect(res.error).toBeTruthy();
    expect(prisma.client.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateClientAction (full edit)
// ---------------------------------------------------------------------------
const validEdit = {
  fullName: "עדי כהן",
  phone: "0501234567",
  email: "adi@example.com",
  notes: "VIP",
};

describe("updateClientAction", () => {
  it("updates an owned client, normalizing the phone and persisting opt-in fields", async () => {
    prisma.client.findUnique
      .mockResolvedValueOnce({ id: "cli_1", businessId: BUSINESS_A }) // existence
      .mockResolvedValueOnce(null); // duplicate-phone check
    prisma.client.update.mockResolvedValue(makeClient({ id: "cli_1" }));

    const res = await updateClientAction(
      "cli_1",
      {},
      fd({ ...validEdit, whatsappOptIn: "true", marketingOptIn: "true" }),
    );
    expect(res.success).toBe(true);
    expect(prisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cli_1" },
        data: expect.objectContaining({
          fullName: "עדי כהן",
          phone: "0501234567",
          normalizedPhone: "+972501234567",
          whatsappOptIn: true,
          marketingOptIn: true,
        }),
      }),
    );
  });

  it("rejects a cross-tenant client id WITHOUT mutating", async () => {
    prisma.client.findUnique.mockResolvedValue({
      id: "cli_1",
      businessId: BUSINESS_B,
    });
    const res = await updateClientAction("cli_1", {}, fd(validEdit));
    expect(res.formError).toBeTruthy();
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it("returns field errors (and no write) when name is missing", async () => {
    prisma.client.findUnique.mockResolvedValue({
      id: "cli_1",
      businessId: BUSINESS_A,
    });
    const res = await updateClientAction(
      "cli_1",
      {},
      fd({ ...validEdit, fullName: "" }),
    );
    expect(res.fieldErrors?.fullName).toBeTruthy();
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it("returns a phone error for an invalid phone", async () => {
    prisma.client.findUnique.mockResolvedValue({
      id: "cli_1",
      businessId: BUSINESS_A,
    });
    const res = await updateClientAction(
      "cli_1",
      {},
      fd({ ...validEdit, phone: "123" }),
    );
    expect(res.fieldErrors?.phone).toBeTruthy();
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it("rejects a duplicate phone that belongs to a DIFFERENT client in the same business", async () => {
    prisma.client.findUnique
      .mockResolvedValueOnce({ id: "cli_1", businessId: BUSINESS_A }) // existence
      .mockResolvedValueOnce({ id: "cli_2" }); // duplicate owned by another client
    const res = await updateClientAction("cli_1", {}, fd(validEdit));
    expect(res.fieldErrors?.phone).toBeTruthy();
    expect(prisma.client.update).not.toHaveBeenCalled();
    // duplicate check is scoped to the business via the compound unique key
    const dupCall = prisma.client.findUnique.mock.calls[1][0] as {
      where: { businessId_normalizedPhone: { businessId: string } };
    };
    expect(dupCall.where.businessId_normalizedPhone.businessId).toBe(BUSINESS_A);
  });

  it("allows saving when the only matching phone is the client's own row", async () => {
    prisma.client.findUnique
      .mockResolvedValueOnce({ id: "cli_1", businessId: BUSINESS_A })
      .mockResolvedValueOnce({ id: "cli_1" }); // duplicate is self -> allowed
    prisma.client.update.mockResolvedValue(makeClient({ id: "cli_1" }));
    const res = await updateClientAction("cli_1", {}, fd(validEdit));
    expect(res.success).toBe(true);
    expect(prisma.client.update).toHaveBeenCalled();
  });

  it("maps a Prisma unique-constraint violation to a phone duplicate error", async () => {
    prisma.client.findUnique
      .mockResolvedValueOnce({ id: "cli_1", businessId: BUSINESS_A })
      .mockResolvedValueOnce(null);
    prisma.client.update.mockRejectedValue(
      new Error("Unique constraint failed on the fields"),
    );
    const res = await updateClientAction("cli_1", {}, fd(validEdit));
    expect(res.fieldErrors?.phone).toBeTruthy();
  });

  it("returns a safe generic error for other write failures", async () => {
    prisma.client.findUnique
      .mockResolvedValueOnce({ id: "cli_1", businessId: BUSINESS_A })
      .mockResolvedValueOnce(null);
    prisma.client.update.mockRejectedValue(new Error("secret db meltdown"));
    const res = await updateClientAction("cli_1", {}, fd(validEdit));
    expect(res.formError).toBeTruthy();
    expect(res.formError).not.toContain("secret");
  });
});
