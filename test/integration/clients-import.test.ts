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

const requireTenant = vi.fn(async () => ({ businessId: BUSINESS_A }));
vi.mock("@/server/auth/session", () => ({
  requireTenant: (...args: unknown[]) => (requireTenant as (...a: unknown[]) => unknown)(...args),
}));

import { importClients } from "@/server/clients/import";

beforeEach(() => {
  resetPrismaMock(prisma);
  requireTenant.mockReset().mockResolvedValue({ businessId: BUSINESS_A });
});

describe("importClients", () => {
  it("loads existing normalized phones scoped by businessId", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    prisma.client.create.mockResolvedValue({ id: "cli_new" });
    // Non-empty: an empty array short-circuits before any query.
    await importClients([{ fullName: "דנה", phone: "0501234567" }]);
    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: BUSINESS_A },
        select: { normalizedPhone: true },
      }),
    );
  });

  // `rows` is whatever the caller POSTs to this Server Action. Without a cap a
  // huge array becomes that many sequential INSERTs in one request, saturating
  // the shared connection pool and degrading every other tenant.
  it("refuses an oversized batch without touching the database", async () => {
    const rows = Array.from({ length: 2001 }, () => ({
      fullName: "דנה",
      phone: "0501234567",
    }));
    const res = await importClients(rows);
    expect(res.created).toBe(0);
    expect(res.failed).toBe(2001);
    expect(prisma.client.create).not.toHaveBeenCalled();
  });

  it("counts rows with an invalid phone as failed instead of storing them", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    prisma.client.create.mockResolvedValue({ id: "cli_new" });
    const res = await importClients([
      { fullName: "דנה", phone: "not-a-phone" },
      { fullName: "", phone: "0501234567" },
    ]);
    expect(res.created).toBe(0);
    expect(res.failed).toBe(2);
    expect(prisma.client.create).not.toHaveBeenCalled();
  });

  it("creates new clients scoped to the business and counts them", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    prisma.client.create.mockResolvedValue({ id: "cli_new" });

    const res = await importClients([
      { fullName: " דנה ", phone: "0501234567", email: " a@b.com ", notes: " x " },
      { fullName: "רותם", phone: "0529999999" },
    ]);

    expect(res).toEqual({ created: 2, duplicates: 0, failed: 0 });
    expect(prisma.client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: BUSINESS_A,
          fullName: "דנה", // trimmed
          normalizedPhone: "+972501234567",
          email: "a@b.com",
          notes: "x",
        }),
      }),
    );
  });

  it("skips rows whose phone already exists (DB duplicate)", async () => {
    prisma.client.findMany.mockResolvedValue([
      { normalizedPhone: "+972501234567" },
    ]);
    const res = await importClients([
      { fullName: "דנה", phone: "050-123-4567" },
    ]);
    expect(res).toEqual({ created: 0, duplicates: 1, failed: 0 });
    expect(prisma.client.create).not.toHaveBeenCalled();
  });

  it("deduplicates rows within the same batch", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    prisma.client.create.mockResolvedValue({ id: "cli_new" });
    const res = await importClients([
      { fullName: "דנה", phone: "0501234567" },
      { fullName: "דנה שוב", phone: "+972501234567" }, // same normalized phone
    ]);
    expect(res).toEqual({ created: 1, duplicates: 1, failed: 0 });
    expect(prisma.client.create).toHaveBeenCalledTimes(1);
  });

  it("counts a row as failed when create throws", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    prisma.client.create.mockRejectedValue(new Error("db error"));
    const res = await importClients([
      { fullName: "דנה", phone: "0501234567" },
    ]);
    expect(res).toEqual({ created: 0, duplicates: 0, failed: 1 });
  });
});
