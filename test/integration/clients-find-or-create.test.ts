import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, makeClient } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

import { findOrCreateClient } from "@/server/clients/find-or-create";

const tenant = { businessId: BUSINESS_A };

beforeEach(() => resetPrismaMock(prisma));

describe("findOrCreateClient — dedup & tenant scoping", () => {
  it("looks up by the compound businessId_normalizedPhone unique key (normalized)", async () => {
    prisma.client.findUnique.mockResolvedValue(null);
    prisma.client.create.mockResolvedValue(makeClient());

    await findOrCreateClient(tenant, { fullName: "דנה", phone: "050-123-4567" });

    expect(prisma.client.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId_normalizedPhone: {
            businessId: BUSINESS_A,
            normalizedPhone: "+972501234567", // normalized from 050-123-4567
          },
        },
      }),
    );
  });

  it("returns the existing client and does NOT create when phone already exists in the business", async () => {
    const existing = makeClient({ id: "cli_existing", fullName: "דנה" });
    prisma.client.findUnique.mockResolvedValue(existing);

    const res = await findOrCreateClient(tenant, {
      fullName: "דנה",
      phone: "0501234567",
    });

    expect(res).toBe(existing);
    expect(prisma.client.create).not.toHaveBeenCalled();
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it("does NOT overwrite an existing non-empty name with a different incoming name", async () => {
    const existing = makeClient({ id: "cli_existing", fullName: "דנה כהן" });
    prisma.client.findUnique.mockResolvedValue(existing);

    const res = await findOrCreateClient(tenant, {
      fullName: "שם אחר לגמרי",
      phone: "0501234567",
    });

    expect(res).toBe(existing);
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it("fills in the name only when the existing client's name is empty", async () => {
    const existing = makeClient({ id: "cli_existing", fullName: "" });
    prisma.client.findUnique.mockResolvedValue(existing);
    prisma.client.update.mockResolvedValue(
      makeClient({ id: "cli_existing", fullName: "דנה" }),
    );

    await findOrCreateClient(tenant, { fullName: "דנה", phone: "0501234567" });

    expect(prisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cli_existing" },
        data: { fullName: "דנה" },
      }),
    );
  });

  it("does not update when existing name is empty AND no incoming name is provided", async () => {
    const existing = makeClient({ id: "cli_existing", fullName: "" });
    prisma.client.findUnique.mockResolvedValue(existing);

    const res = await findOrCreateClient(tenant, { fullName: "", phone: "0501234567" });
    expect(res).toBe(existing);
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it("creates a new client scoped to the business with the normalized phone", async () => {
    prisma.client.findUnique.mockResolvedValue(null);
    prisma.client.create.mockResolvedValue(makeClient({ id: "cli_new" }));

    await findOrCreateClient(tenant, { fullName: "דנה", phone: "972-50-123-4567" });

    expect(prisma.client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: BUSINESS_A,
          fullName: "דנה",
          phone: "972-50-123-4567",
          normalizedPhone: "+972501234567",
        }),
      }),
    );
  });
});
