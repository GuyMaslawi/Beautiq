import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BUSINESS_A, makeWhatsAppConnection } from "../helpers/factories";

/**
 * getWhatsAppConnectionStatusAction is the business-scoped, read-only status the
 * connection card polls after the Embedded Signup popup closes. SECURITY: it must
 * expose ONLY owner/admin-safe fields — never the access token, encrypted
 * credentials, WABA id, or phone number id.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof import("../helpers/prisma-mock").createPrismaMock>;

const requireCurrentBusiness = vi.fn(async () => ({ id: BUSINESS_A }));
vi.mock("@/server/auth/session", () => ({
  requireCurrentBusiness: (...a: unknown[]) =>
    (requireCurrentBusiness as (...x: unknown[]) => unknown)(...a),
}));

import { resetPrismaMock } from "../helpers/prisma-mock";
import { getWhatsAppConnectionStatusAction } from "@/server/whatsapp/connection-status-actions";

const ENCRYPTION_KEY = "a".repeat(64);

beforeEach(() => {
  resetPrismaMock(prisma);
  requireCurrentBusiness.mockReset().mockResolvedValue({ id: BUSINESS_A });
  process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = ENCRYPTION_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getWhatsAppConnectionStatusAction", () => {
  it("reports connected=true / active for a live connection, scoped to the business", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ status: "active", useEnvFallback: true }),
    );

    const res = await getWhatsAppConnectionStatusAction();

    expect(res.connected).toBe(true);
    expect(res.state).toBe("active");
    expect(res.displayPhoneNumber).toBeDefined();
    // The status is read scoped to the current business (never by raw record id).
    expect(prisma.whatsAppConnection.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: BUSINESS_A } }),
    );
  });

  it("reports connected=false / not_connected when there is no connection", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);

    const res = await getWhatsAppConnectionStatusAction();
    expect(res.connected).toBe(false);
    expect(res.state).toBe("not_connected");
  });

  it("NEVER returns the token, encrypted credentials, WABA id, or phone number id", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({
        status: "active",
        useEnvFallback: true,
        accessTokenEncrypted: "v1:super-secret-ciphertext",
        wabaId: "waba_123",
        phoneNumberId: "phone_123",
      }),
    );

    const res = await getWhatsAppConnectionStatusAction();
    const json = JSON.stringify(res);

    expect(json).not.toContain("super-secret-ciphertext");
    expect(json).not.toContain("waba_123");
    expect(json).not.toContain("phone_123");
    // No credential-bearing keys leak onto the view object.
    expect(res).not.toHaveProperty("accessTokenEncrypted");
    expect(res).not.toHaveProperty("wabaId");
    expect(res).not.toHaveProperty("phoneNumberId");
  });

  it("surfaces an error state with a (token-scrubbed) reason for diagnostics", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ status: "error", lastError: "רישום המספר נכשל" }),
    );

    const res = await getWhatsAppConnectionStatusAction();
    expect(res.connected).toBe(false);
    expect(res.state).toBe("error");
    expect(res.lastError).toBe("רישום המספר נכשל");
  });
});
