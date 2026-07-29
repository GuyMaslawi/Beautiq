import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";

/**
 * שחזור סיסמה — התכונות האבטחתיות, לא רק הזרימה המאושרת.
 *
 * הזרימה הזו היא נקודת כניסה אנונימית שמחליפה אישור התחברות, ולכן הבדיקות
 * כאן מכוונות לדרכים שבהן היא נשברת: טוקן שנשמר בגלוי, טוקן שנשאר תקף אחרי
 * שימוש, טוקן שפג ועדיין עובד, וסשן קיים ששורד את השחזור.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

const sendEmail = vi.fn();
const isEmailConfigured = vi.fn(() => true);
vi.mock("@/lib/email/send", () => ({
  sendEmail: (p: unknown) => sendEmail(p),
  isEmailConfigured: () => isEmailConfigured(),
}));

import {
  issuePasswordReset,
  checkResetToken,
  consumeResetToken,
  buildResetUrl,
} from "@/server/auth/password-reset";

const sha256 = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");

beforeEach(() => {
  resetPrismaMock(prisma);
  sendEmail.mockReset().mockResolvedValue({ ok: true, id: "em_1" });
  isEmailConfigured.mockReset().mockReturnValue(true);
  // $transaction במוק מריץ את הפעולות שהועברו לו.
  prisma.$transaction.mockImplementation(async (ops: unknown) =>
    Array.isArray(ops) ? Promise.all(ops) : ops,
  );
});

describe("issuePasswordReset", () => {
  it("stores only a HASH of the token — never the token itself", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "usr_1",
      email: "owner@test.local",
      name: "בעלת העסק",
    });

    await issuePasswordReset("owner@test.local");

    const createArg = prisma.passwordResetToken.create.mock.calls[0][0] as {
      data: { tokenHash: string };
    };
    // הקישור שנשלח מכיל את הטוקן הגולמי; המסד מכיל רק את הגיבוב שלו.
    const sentBody = (sendEmail.mock.calls[0][0] as { text: string }).text;
    const rawToken = decodeURIComponent(
      (sentBody.match(/token=([^\s]+)/) || [])[1] ?? "",
    );

    expect(rawToken.length).toBeGreaterThan(20);
    expect(createArg.data.tokenHash).toBe(sha256(rawToken));
    // הערך הגולמי לא נשמר בשום שדה.
    expect(JSON.stringify(createArg.data)).not.toContain(rawToken);
  });

  it("does NOT reveal whether the email exists (no user → silent no-op)", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const r = await issuePasswordReset("nobody@test.local");
    expect(r.delivered).toBe(false);
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("invalidates previous unused tokens so only the newest link works", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "usr_1",
      email: "owner@test.local",
      name: null,
    });
    await issuePasswordReset("owner@test.local");
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "usr_1", usedAt: null } }),
    );
  });

  it("never logs the reset link in production when email is unconfigured", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "usr_1",
      email: "owner@test.local",
      name: null,
    });
    isEmailConfigured.mockReturnValue(false);
    vi.stubEnv("NODE_ENV", "production");
    // בפרודקשן ממשיכים לנסות לשלוח (ולא רושמים את הקישור ללוג).
    await issuePasswordReset("owner@test.local");
    expect(sendEmail).toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

describe("checkResetToken", () => {
  const RAW = "raw-token-value-abcdefghijklmnop";

  function row(extra: Record<string, unknown> = {}) {
    return {
      id: "tok_1",
      userId: "usr_1",
      tokenHash: sha256(RAW),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      ...extra,
    };
  }

  it("accepts a fresh, unused token", async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue(row());
    await expect(checkResetToken(RAW)).resolves.toMatchObject({
      valid: true,
      userId: "usr_1",
    });
  });

  it("rejects an unknown token", async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue(null);
    await expect(checkResetToken("bogus")).resolves.toEqual({
      valid: false,
      reason: "invalid",
    });
  });

  it("rejects an EXPIRED token", async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue(
      row({ expiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(checkResetToken(RAW)).resolves.toEqual({
      valid: false,
      reason: "expired",
    });
  });

  it("rejects an ALREADY USED token (single-use)", async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue(
      row({ usedAt: new Date() }),
    );
    await expect(checkResetToken(RAW)).resolves.toEqual({
      valid: false,
      reason: "used",
    });
  });

  it("rejects absurdly long input without touching the DB", async () => {
    await expect(checkResetToken("x".repeat(600))).resolves.toEqual({
      valid: false,
      reason: "invalid",
    });
    expect(prisma.passwordResetToken.findUnique).not.toHaveBeenCalled();
  });
});

describe("consumeResetToken", () => {
  const RAW = "raw-token-value-abcdefghijklmnop";

  beforeEach(() => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: "tok_1",
      userId: "usr_1",
      tokenHash: sha256(RAW),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
  });

  // הליבה של התיקון: שחזור סיסמה בעקבות פריצה חייב גם להוציא את התוקף.
  // סשנים הם JWT ואינם נשמרים בשרת, ולכן בלי החותם הזה החלפת הסיסמה הייתה
  // משאירה את הסשן שכבר בידיו תקף עד סופו.
  it("stamps sessionsValidFrom so existing sessions are revoked", async () => {
    await consumeResetToken(RAW, "NewPassword123!");

    const updateArg = prisma.user.update.mock.calls[0][0] as {
      where: { id: string };
      data: { passwordHash: string; sessionsValidFrom: Date };
    };
    expect(updateArg.where).toEqual({ id: "usr_1" });
    expect(updateArg.data.sessionsValidFrom).toBeInstanceOf(Date);
    expect(updateArg.data.passwordHash).toBeTruthy();
    // הסיסמה נשמרת מגובבת, לעולם לא בגלוי.
    expect(updateArg.data.passwordHash).not.toBe("NewPassword123!");
  });

  it("marks the token used so it cannot be replayed", async () => {
    await consumeResetToken(RAW, "NewPassword123!");
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tok_1" },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      }),
    );
  });

  it("refuses an expired token and changes NOTHING", async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: "tok_1",
      userId: "usr_1",
      tokenHash: sha256(RAW),
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });
    const r = await consumeResetToken(RAW, "NewPassword123!");
    expect(r).toEqual({ valid: false, reason: "expired" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe("buildResetUrl", () => {
  it("URL-encodes the token", () => {
    expect(buildResetUrl("a+b/c=")).toContain("token=a%2Bb%2Fc%3D");
  });
});
