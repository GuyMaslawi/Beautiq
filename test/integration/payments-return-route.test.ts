import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

import { GET as successGet } from "@/app/api/payments/return/success/route";
import { GET as failureGet } from "@/app/api/payments/return/failure/route";

function call(
  handler: (r: NextRequest) => Promise<Response>,
  bp: string,
) {
  const url = `http://localhost/api/payments/return/x?bp=${encodeURIComponent(bp)}`;
  return handler(new NextRequest(url, { method: "GET" }));
}

beforeEach(() => resetPrismaMock(prisma));

describe("payment return routes", () => {
  it("success → redirects to the public page success state (no DB writes)", async () => {
    prisma.bookingPayment.findUnique.mockResolvedValue({
      business: { slug: "studio-yofi" },
    });

    const res = await call(successGet, "bp_1");
    const loc = res.headers.get("location") ?? "";

    expect(res.status).toBe(307);
    expect(loc).toContain("/b/studio-yofi");
    expect(loc).toContain("bookingSuccess=bp_1");
    // A client return is never allowed to mutate payment state.
    expect(prisma.bookingPayment.update).not.toHaveBeenCalled();
  });

  it("failure → redirects to the same public page state (DB drives the view)", async () => {
    prisma.bookingPayment.findUnique.mockResolvedValue({
      business: { slug: "studio-yofi" },
    });

    const res = await call(failureGet, "bp_1");
    const loc = res.headers.get("location") ?? "";

    expect(res.status).toBe(307);
    expect(loc).toContain("/b/studio-yofi");
    expect(loc).toContain("bookingSuccess=bp_1");
    expect(prisma.bookingPayment.update).not.toHaveBeenCalled();
  });

  it("unknown token → falls back to the minimal status page", async () => {
    prisma.bookingPayment.findUnique.mockResolvedValue(null);

    const res = await call(successGet, "missing");
    const loc = res.headers.get("location") ?? "";

    expect(res.status).toBe(307);
    expect(loc).toContain("/pay/status");
    expect(loc).toContain("bp=missing");
  });
});
