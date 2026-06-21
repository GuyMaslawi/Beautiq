import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

const auth = vi.fn();
vi.mock("@/server/auth/config", () => ({ auth: () => auth() }));

const put = vi.fn();
vi.mock("@vercel/blob", () => ({ put: (...a: unknown[]) => put(...a) }));

import { POST } from "@/app/api/upload/route";

function fileFormData(file?: File | string): Request {
  const fd = new FormData();
  if (file !== undefined) fd.set("file", file as Blob | string);
  return new Request("http://localhost/api/upload", { method: "POST", body: fd });
}

beforeEach(() => {
  resetPrismaMock(prisma);
  auth.mockReset();
  put.mockReset();
});

describe("POST /api/upload", () => {
  it("401 when there is no session user", async () => {
    auth.mockResolvedValue(null);
    const res = await POST(fileFormData());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("לא מורשה");
    expect(put).not.toHaveBeenCalled();
  });

  it("403 when the user has no business membership", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.businessUser.findFirst.mockResolvedValue(null);
    const res = await POST(fileFormData());
    expect(res.status).toBe(403);
    expect(put).not.toHaveBeenCalled();
  });

  it("400 when no file is provided", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.businessUser.findFirst.mockResolvedValue({ businessId: "biz1" });
    const res = await POST(fileFormData("not-a-file"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("לא נשלח קובץ");
  });

  it("400 for a disallowed file type", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.businessUser.findFirst.mockResolvedValue({ businessId: "biz1" });
    const f = new File(["x"], "doc.gif", { type: "image/gif" });
    const res = await POST(fileFormData(f));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/JPG, PNG/);
  });

  it("400 when the file exceeds the max size", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.businessUser.findFirst.mockResolvedValue({ businessId: "biz1" });
    const big = new File([new Uint8Array(11 * 1024 * 1024)], "big.png", {
      type: "image/png",
    });
    const res = await POST(fileFormData(big));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/10MB/);
  });

  it("uploads to a business-scoped path and returns the blob url", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.businessUser.findFirst.mockResolvedValue({ businessId: "biz1" });
    put.mockResolvedValue({ url: "https://blob/biz1/image.png" });

    const f = new File(["abc"], "image.png", { type: "image/png" });
    const res = await POST(fileFormData(f));
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://blob/biz1/image.png");

    const [filename, , opts] = put.mock.calls[0];
    expect(filename).toMatch(/^businesses\/biz1\/\d+\.png$/);
    expect(opts).toMatchObject({ access: "public", contentType: "image/png" });
  });
});
