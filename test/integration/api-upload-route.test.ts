import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/upload now resolves the tenant through requireTenant(), which
 * authenticates AND enforces the plan/suspension gate before deriving
 * businessId from the session — so an unpaid or admin-suspended account can no
 * longer push billable blobs. It also verifies the real image type from the
 * file's magic bytes rather than trusting the client-declared Content-Type.
 */
const getCurrentUser = vi.fn();
const getCurrentBusiness = vi.fn();
vi.mock("@/server/auth/session", () => ({
  getCurrentUser: () => getCurrentUser(),
  getCurrentBusiness: () => getCurrentBusiness(),
}));

const checkRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimit(...a),
}));

const put = vi.fn();
vi.mock("@vercel/blob", () => ({ put: (...a: unknown[]) => put(...a) }));

import { POST } from "@/app/api/upload/route";

/** Magic-byte prefixes for the three types we accept. */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

function imageFile(
  magic: number[],
  name: string,
  type: string,
  extraBytes = 16,
): File {
  const bytes = new Uint8Array(magic.length + extraBytes);
  bytes.set(magic, 0);
  return new File([bytes], name, { type });
}

function fileFormData(file?: File | string): Request {
  const fd = new FormData();
  if (file !== undefined) fd.set("file", file as Blob | string);
  return new Request("http://localhost/api/upload", { method: "POST", body: fd });
}

/** A paid, non-suspended owner — the normal caller. */
function paidOwner(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    email: "owner@example.com",
    name: "בעלת העסק",
    isAdmin: false,
    plan: "premium",
    planActivatedAt: new Date("2026-01-01T00:00:00Z"),
    suspendedUntil: null,
    impersonating: false,
    ...overrides,
  };
}

beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue(paidOwner());
  getCurrentBusiness.mockReset().mockResolvedValue({ id: "biz1" });
  checkRateLimit.mockReset().mockReturnValue(true);
  put.mockReset();
});

describe("POST /api/upload", () => {
  it("401 when there is no session user", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST(fileFormData());
    expect(res.status).toBe(401);
    expect(put).not.toHaveBeenCalled();
  });

  // Suspension and the paywall must hold here too: uploads are billable storage,
  // and a route handler is reachable without ever rendering the (app) layout.
  it("403 for a suspended account", async () => {
    getCurrentUser.mockResolvedValue(
      paidOwner({ suspendedUntil: new Date(Date.now() + 86_400_000) }),
    );
    const res = await POST(fileFormData());
    expect(res.status).toBe(403);
    expect(put).not.toHaveBeenCalled();
  });

  it("403 for an unpaid account", async () => {
    getCurrentUser.mockResolvedValue(paidOwner({ plan: null }));
    const res = await POST(fileFormData());
    expect(res.status).toBe(403);
    expect(put).not.toHaveBeenCalled();
  });

  it("403 when the user has no business", async () => {
    getCurrentBusiness.mockResolvedValue(null);
    const res = await POST(fileFormData());
    expect(res.status).toBe(403);
    expect(put).not.toHaveBeenCalled();
  });

  it("429 once the per-business upload quota is exhausted", async () => {
    checkRateLimit.mockReturnValue(false);
    const res = await POST(fileFormData(imageFile(PNG_MAGIC, "a.png", "image/png")));
    expect(res.status).toBe(429);
    expect(put).not.toHaveBeenCalled();
    // Quota is keyed on the business — an authenticated identity that cannot be rotated.
    expect(checkRateLimit).toHaveBeenCalledWith(
      "upload:biz1",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("400 when no file is provided", async () => {
    const res = await POST(fileFormData("not-a-file"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("לא נשלח קובץ");
  });

  it("400 for a disallowed file type", async () => {
    const gif = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38])], "doc.gif", {
      type: "image/gif",
    });
    const res = await POST(fileFormData(gif));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/JPG, PNG/);
  });

  // The declared Content-Type is attacker-controlled; only the bytes count.
  it("400 when the bytes are not really an image, despite an image/png header", async () => {
    const fake = new File(["<svg onload=alert(1)>"], "x.png", { type: "image/png" });
    const res = await POST(fileFormData(fake));
    expect(res.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });

  it("400 when the file exceeds the max size", async () => {
    const big = imageFile(PNG_MAGIC, "big.png", "image/png", 11 * 1024 * 1024);
    const res = await POST(fileFormData(big));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/10MB/);
  });

  it("uploads to a business-scoped path and returns the blob url", async () => {
    put.mockResolvedValue({ url: "https://blob/biz1/image.png" });

    const res = await POST(
      fileFormData(imageFile(PNG_MAGIC, "image.png", "image/png")),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://blob/biz1/image.png");

    const [filename, , opts] = put.mock.calls[0];
    expect(filename).toMatch(/^businesses\/biz1\/\d+\.png$/);
    expect(opts).toMatchObject({ access: "public", contentType: "image/png" });
  });

  // contentType is persisted from the SNIFFED type, so a mislabelled part header
  // can never dictate how the blob is later served.
  it("stores the sniffed content type, not the declared one", async () => {
    put.mockResolvedValue({ url: "https://blob/biz1/image.jpeg" });

    // Real JPEG bytes, but the client claims image/png.
    const res = await POST(
      fileFormData(imageFile(JPEG_MAGIC, "image.png", "image/png")),
    );
    expect(res.status).toBe(200);

    const [filename, , opts] = put.mock.calls[0];
    expect(filename).toMatch(/^businesses\/biz1\/\d+\.jpeg$/);
    expect(opts).toMatchObject({ contentType: "image/jpeg" });
  });
});
